import {Logger} from 'winston';
import Icinga from '../icinga';
import Resource from './abstract.resource';

interface NodeOptions {
  discover?: boolean;
  hostDefinition?: object;
  hostTemplates?: string[];
}

/**
 * kubernetes hosts
 */
export default class Node extends Resource {
  protected logger: Logger;
  protected icinga: Icinga;
  protected nodes: string[] = [];
  protected options: NodeOptions = {
    discover: true,
    hostDefinition: {},
    hostTemplates: [],
  };

  /**
   * kubernetes hosts
   */
  constructor(logger: Logger, icinga: Icinga, options: NodeOptions) {
    super();
    this.logger = logger;
    this.icinga = icinga;
    this.options = Object.assign(this.options, options);
  }

  /**
   * Preapre icinga object and apply
   */
  public async prepareObject(definition: any): Promise<boolean> {
    let host = {
      'display_name': definition.metadata.name,
      'address': definition.metadata.name,
      'vars._kubernetes': true,
      'vars.kubernetes': definition,
      'check_command': 'ping',
    };

    if (!definition.spec.unschedulable) {
      this.logger.debug('skip kube worker node '+definition.metadata.name+' since it is flagged as unschedulable');
      this.nodes.push(definition.metadata.name);
    }

    Object.assign(host, this.options.hostDefinition);
    return this.icinga.applyHost(definition.metadata.name, host, this.options.hostTemplates);
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
  public async kubeListener(provider) {
    try {
      let stream = provider();
      stream.on('data', async (object) => {
        // ignore MODIFIER for kube nodes
        if (object.type === 'MODIFIED') {
          return;
        }

        this.logger.debug('received kubernetes host resource', {object});
        if (object.object.kind !== 'Node') {
          this.logger.error('skip invalid node object', {object: object});
          return;
        }

        if (object.object.metadata.annotations && object.object.metadata.annotations['kube-icinga/discover'] === 'false') {
          this.logger.info('skip node object, kube-icinga/discover===false', {object: object});
          return;
        }

        if (object.type == 'DELETED') {
          await this.icinga.deleteHost(object.object.metadata.name);
        }

        if (object.type == 'ADDED') {
          this.prepareObject(object.object).catch((err) => {
            this.logger.error('failed to handle resource', {error: err});
          });
        }
      });

      stream.on('finish', () => {
        this.kubeListener(provider);
      });
    } catch (err) {
      this.logger.error('failed start nodes listener', {error: err});
    }
  }
}
