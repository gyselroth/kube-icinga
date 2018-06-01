import {LoggerInstance} from 'winston';
import Icinga from '../icinga';
import JSONStream from 'json-stream';
import KubeNode from './node';

/**
 * kubernetes services
 */
export default class Service {
  static readonly TYPE_CLUSTERIP = 'ClusterIP';
  static readonly TYPE_NODEPORT = 'NodePort';
  static readonly TYPE_LOADBALANCER = 'LoadBalancer';

  protected logger: LoggerInstance;
  protected kubeClient;
  protected icinga: Icinga;
  protected jsonStream: JSONStream;
  protected kubeNode: KubeNode;
  protected options = {
    ClusterIP: {
      discovery: false,
      applyServices: true,
      hostDefinition: {},
      serviceDefinition: {},
      hostTemplates: [],
      serviceTemplates: [],
    },
    NodePort: {
      discovery: true,
      applyServices: true,
      hostDefinition: {},
      serviceDefinition: {},
      hostTemplates: [],
      serviceTemplates: [],
    },
    LoadBalancer: {
      discovery: true,
      applyServices: true,
      hostDefinition: {},
      serviceDefinition: {},
      hostTemplates: [],
      serviceTemplates: [],
    },
  };

  /**
   * kubernetes services
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
  protected async applyHost(name: string, address: string, type: string, metadata, templates: string[]) {
    let definition = {
      'display_name': name,
      'address': address,
      'check_command': 'dummy',
      'vars.dummy_state': 0,
      'vars._kubernetes': true,
      'vars.kubernetes': metadata,
    };

    Object.assign(definition, this.options[type].hostDefinition);
    return this.icinga.applyHost(name, address, definition, templates);
  }

  /**
   * Apply service
   */
  protected async applyService(host: string, name: string, type: string, definition, templates: string[]) {
    if (type === Service.TYPE_NODEPORT) {
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
   * Prepare icinga object and apply
   */
  public async prepareObject(definition): Promise<any> {
    let serviceType = definition.spec.type;
    let options = this.options[serviceType];

    if (serviceType !== Service.TYPE_NODEPORT) {
      await this.applyHost(definition.metadata.name, definition.spec.clusterIP, serviceType, definition, options.hostTemplates);
    }

    if (options.applyServices) {
      await this.icinga.applyServiceGroup(definition.metadata.namespace);

      for (const servicePort of definition.spec.ports) {
        let service;

        if (servicePort.name && options.portNameAsCommand) {
          let name = servicePort.name.toLowerCase();
          let hasCommand = await this.icinga.hasCheckCommand(name);

          if (hasCommand) {
            this.logger.debug('service can be checked via check command '+name);
            service = {
              'check_command': name,
              'display_name': name,
              'vars._kubernetes': true,
              'vars.kubernetes': definition,
              'groups': [definition.metadata.namespace],
            };
            service['vars.'+servicePort.name+'_port'] = servicePort.nodePort || servicePort.port;
          } else {
            this.logger.warn('service can not be checked via check command '+servicePort.name+', icinga check command does not exists, fallback to '+servicePort.protocol);
          }
        }

        if (!service) {
          let protocol = servicePort.protocol.toLowerCase();
          let name = servicePort.name || protocol+':'+servicePort.port;
          service = {
            'check_command': servicePort.protocol,
            'display_name': name.toLowerCase(),
            'vars._kubernetes': true,
            'vars.kubernetes': definition,
            'groups': [definition.metadata.namespace],
          };

          service['vars.'+protocol+'_port'] = servicePort.nodePort || servicePort.port;
        }

        Object.assign(service, options.serviceDefinition);
        this.applyService(definition.metadata.name, service.display_name, serviceType, service, options.serviceTemplates);
      }
    }
  }

  /**
   * Start kube listener
   */
  public async kubeListener(): Promise<any> {
    try {
      const stream = this.kubeClient.apis.v1.watch.services.getStream();
      stream.pipe(this.jsonStream);
      this.jsonStream.on('data', async (object) => {
        this.logger.debug('received kubernetes service', {object});

        if(object.object.kind !== 'Service') {
          this.logger.error('skip invalid service object', {object: object});
          return;
        }

        if (!this.options[object.object.spec.type].discover) {
          this.logger.debug('skip service object, since ['+object.object.spec.type+'] is not enabled for discovery', {object: object});
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
      this.logger.error('failed start services listener', {error: err});
    }
  }
}
