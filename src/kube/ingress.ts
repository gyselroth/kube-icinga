import {LoggerInstance} from 'winston';
import Icinga from '../icinga';
import JSONStream from 'json-stream';
import KubeNode from './node';

/**
 * kubernetes ingresses
 */
export default class Ingress {
  protected logger: LoggerInstance;
  protected kubeClient;
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
   * kubernetes ingresses
   */
  constructor(logger: LoggerInstance, kubeNode: KubeNode, kubeClient, icinga: Icinga, jsonStream: JSONStream, options: object={}) {
    this.logger = logger;
    this.kubeClient = kubeClient;
    this.icinga = icinga;
    this.jsonStream = jsonStream;
    this.options = Object.assign(this.options, options);
    this.kubeNode = kubeNode;
  }

  /**
   * Apply host
   */
  protected async applyHost(name: string, address: string, metadata, templates: string[]) {
    let definition = {
      'display_name': name,
      'address': address,
      'check_command': 'dummy',
      'vars.dummy_state': 0,
      'vars._kubernetes': true,
      'vars.kubernetes': metadata,
    };

    Object.assign(definition, this.options.hostDefinition);
    return this.icinga.applyHost(name, address, definition, this.options.hostTemplates);
  }

  /**
   * Apply service
   */
  protected async applyService(host: string, name: string, definition) {
    if (this.options.attachToNodes) {
      for (const node of this.kubeNode.getWorkerNodes()) {
        definition.host_name = node;
        this.icinga.applyService(node, name, definition, this.options.serviceTemplates);
      }
    } else {
      definition.host_name = host;
      this.icinga.applyService(host, name, definition, this.options.serviceTemplates);
    }
  }

  /**
   * Preapre icinga object and apply
   */
  public async prepareObject(definition: any): Promise<any> {
    if (!this.options.attachToNodes) {
      await this.applyHost(definition.metadata.name, definition.metadata.name, definition, this.options.hostTemplates);
    }

    if (this.options.applyServices) {
      await this.icinga.applyServiceGroup(definition.metadata.namespace);

      for (const spec of definition.spec.rules) {
        for (const path of spec.http.paths) {
          let base = path.path || '/';
          let service = {
            'check_command': 'http',
            'display_name': `${spec.host}:http`,
            'vars._kubernetes': true,
            'vars.kubernetes': definition,
            'vars.http_address': spec.host,
            'vars.http_vhost': spec.host,
            'vars.http_path': base,
            'vars.http_ignore_body': true,
            'groups': [definition.metadata.namespace],
          };

          Object.assign(service, this.options.serviceDefinition);
          this.applyService(definition.metadata.name, service.display_name, service);

          // tls secret set, also apply https service
          if (definition.spec.tls) {
            service.display_name += 's';
            service['vars.http_ssl'] = true;
            this.applyService(definition.metadata.name, service.display_name, service);
          }
        }
      }
    }
  }

  /**
   * Start kube listener
   */
  public async kubeListener(): Promise<any> {
    try {
      const stream = this.kubeClient.apis.extensions.v1beta1.watch.ingresses.getStream();
      stream.pipe(this.jsonStream);
      this.jsonStream.on('data', async (object) => {
        this.logger.debug('received kubernetes ingress', {object});

        if(object.object.kind !== 'Ingress') {
          this.logger.error('skip invalid ingress object', {object: object});
          return;
        }

        if (object.type == 'MODIFIED' || object.type == 'DELETED') {
          await this.icinga.deleteHost(object.object.metadata.name);
        }

        if (object.type == 'ADDED' || object.type == 'MODIFIED') {
          this.prepareObject(object.object);
        }
      });

      this.jsonStream.on('finish', () => {
        this.kubeListener();
      });
    } catch (err) {
      this.logger.error('failed start ingresses listener', {error: err});
    }
  }
}
