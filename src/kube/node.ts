import {LoggerInstance} from 'winston';
import Icinga from '../icinga';
import JSONStream from 'json-stream';

/**
 * kubernetes hosts
 */
export default class Node {
  protected logger: LoggerInstance;
  protected kubeClient;
  protected icinga: Icinga;
  protected jsonStream: JSONStream;
  protected nodes: string[] = [];
  protected options = {
    discovery: true,
    hostDefinition: {},
    hostTemplates: [],
  };

  /**
   * kubernetes hosts
   */
  constructor(logger: LoggerInstance, kubeClient, icinga: Icinga, jsonStream: JSONStream, options) {
    this.logger = logger;
    this.kubeClient = kubeClient;
    this.icinga = icinga;
    this.jsonStream = jsonStream;
    this.options = Object.assign(this.options, options);
  }

  /**
   * Preapre icinga object and apply
   */
  protected async prepareObject(definition: any): Promise<any> {
    let host = {
      'display_name': definition.metadata.name,
      'host_name': definition.metadata.name,
      'vars._kubernetes': true,
      'vars.kubernetes': definition,
      'groups': [definition.metadata.namespace],
    };

    if (!definition.spec.unschedulable) {
      this.logger.debug('skip kube worker node '+definition.metadata.name+' since it is flagged as unschedulable');
      this.nodes.push(definition.metadata.name);
    }

    host = Object.assign(host, this.options.hostDefinition);
    this.icinga.applyHost(host.host_name, host.host_name, host, this.options.hostTemplates);
  }

  /**
   * Get collected nodes
   */
  public getWorkerNodes(): string[] {
    return this.nodes;
  }

  /**
   * Start kube listener
   */
  public async kubeListener(): Promise<any> {
    try {
      const stream = this.kubeClient.apis.v1.watch.nodes.getStream();
      stream.pipe(this.jsonStream);
      this.jsonStream.on('data', async (object) => {
        // ignore MODIFIER for kube nodes
        if (object.type === 'MODIFIED') {
          return;
        }

        this.logger.debug('received kubernetes host', {object});
        if(object.object.kind !== 'Node') {
          this.logger.error('skip invalid node object', {object: object});
          return;
        }

        if (object.type == 'DELETED') {
          await this.icinga.deleteHost(object.object.metadata.name);
        }

        if (object.type == 'ADDED') {
          this.prepareObject(object.object);
        }
      });

      this.jsonStream.on('finish', () => {
        this.kubeListener();
      });
    } catch (err) {
      this.logger.error('failed start nodes listener', {error: err});
    }
  }
}
