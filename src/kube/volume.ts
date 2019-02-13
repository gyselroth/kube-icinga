import {Logger} from 'winston';
import Icinga from '../icinga';
import JSONStream from 'json-stream';
import KubeNode from './node';
import Resource from './abstract.resource';

interface VolumeOptions {
  discover?: boolean;
  applyServices?: boolean;
  attachToNodes?: boolean;
  hostDefinition?: object;
  serviceDefinition?: object;
  hostTemplates?: string[];
  serviceTemplates?: string[];
}

/**
 * kubernetes ingresses
 */
export default class Volume extends Resource {
  protected logger: Logger;
  protected icinga: Icinga;
  protected jsonStream: JSONStream;
  protected kubeNode: KubeNode;
  protected options = {
    applyServices: true,
    attachToNodes: false,
    hostDefinition: {},
    serviceDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  };

  /**
   * kubernetes hosts
   */
  constructor(logger: Logger, kubeNode: KubeNode, icinga: Icinga, jsonStream: JSONStream, options: VolumeOptions) {
    super();
    this.logger = logger;
    this.icinga = icinga;
    this.jsonStream = jsonStream;
    this.kubeNode = kubeNode;
    this.options = Object.assign(this.options, options);
  }  
  
  /**
   * Apply host
   */
  protected async applyHost(name: string, address: string, metadata, templates: string[]): Promise<boolean> {
    let definition = {
      'display_name': name,
      'address': address,
      'check_command': 'dummy',
      'vars.dummy_state': 0,
      'vars._kubernetes': true,
      'vars.kubernetes': metadata,
    };

    Object.assign(definition, this.options.hostDefinition);
    return this.icinga.applyHost(name, definition, this.options.hostTemplates);
  }

  /**
   * Apply service
   */
  protected async applyService(host: string, name: string, definition, templates: string[]) {
    if (this.options.attachToNodes) {
      for (const node of this.kubeNode.getWorkerNodes()) {
        definition.host_name = node;
        this.icinga.applyService(node, name, definition, templates);
      }
    } else {
      definition.host_name = host;
      this.icinga.applyService(host, name, definition, templates);
    }
  }

  /**
   * Preapre icinga object and apply
   */
  public async prepareObject(definition: any): Promise<any> {
    var hostname = this.escapeName(definition.metadata.annotations['pv.kubernetes.io/provisioned-by']);
    await this.applyHost(hostname, hostname, definition, this.options.hostTemplates);

    if (this.options.applyServices) {
      var groups = [];
      if(definition.spec.claimRef.namespace) {
        groups.push(definition.spec.claimRef.namespace)
        await this.icinga.applyServiceGroup(definition.spec.claimRef.namespace);
      }

      let templates = this.options.serviceTemplates;
      templates = templates.concat(this.prepareTemplates(definition));

      let service = this.options.serviceDefinition;
      let name = this.escapeName(['volume', definition.metadata.name].join('-'));
      let addition = {
        'check_command': 'dummy',
        'display_name': `${definition.metadata.name}:volume`,
        'vars._kubernetes': true,
        'vars.kubernetes': definition,
        'groups': groups,
      };

      Object.assign(addition, service);
      Object.assign(addition, this.prepareResource(definition));
      this.applyService(hostname, name, addition, templates);
    }
  }

  /**
   * Start kube listener
   */
  public async kubeListener(provider) {
    try {
      var stream = provider();
      stream.pipe(this.jsonStream);
      this.jsonStream.on('data', async (object) => {
        this.logger.debug('received kubernetes persistent volume resource', {object});

        if(object.object.kind !== 'PersistentVolume') {
          this.logger.error('skip invalid object', {object: object});
          return;
        }

        if (object.type == 'MODIFIED' || object.type == 'DELETED') {
          await this.icinga.deleteHost(object.object.metadata.name);
        }

        if (object.type == 'ADDED' || object.type == 'MODIFIED') {
          this.prepareObject(object.object).catch(err => {
            this.logger.error('failed to handle resource', {error: err})
          });
        }
      });

      this.jsonStream.on('finish', () => {
        this.kubeListener(provider);
      });
    } catch (err) {
      this.logger.error('failed start ingresses listener', {error: err});
    }
  }
}
