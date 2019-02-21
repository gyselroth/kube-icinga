import {Logger} from 'winston';
import Icinga from '../icinga';
import KubeNode from './node';
import Resource from './abstract.resource';

interface ServiceTypeOptions {
  discover?: boolean;
  hostName?: string;
  applyServices?: boolean;
  hostDefinition?: any;
  serviceDefinition?: any;
  hostTemplates?: string[];
  serviceTemplates?: string[];
}

interface ServiceOptions {
  ClusterIP?: ServiceTypeOptions;
  NodePort?: ServiceTypeOptions;
  LoadBalancer?: ServiceTypeOptions;
}

const defaults: ServiceOptions = {
  ClusterIP: {
    discover: false,
    hostName: 'kubernetes-clusterip-services',
    applyServices: true,
    hostDefinition: {},
    serviceDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  },
  NodePort: {
    discover: true,
    hostName: 'kubernetes-nodeport-services',
    applyServices: true,
    hostDefinition: {},
    serviceDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  },
  LoadBalancer: {
    discover: true,
    hostName: 'kubernetes-loadbalancer-services',
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
export default class Service extends Resource {
  static readonly TYPE_CLUSTERIP = 'ClusterIP';
  static readonly TYPE_NODEPORT = 'NodePort';
  static readonly TYPE_LOADBALANCER = 'LoadBalancer';

  protected logger: Logger;
  protected icinga: Icinga;
  protected kubeNode: KubeNode;
  protected options: ServiceOptions = defaults;

  /**
   * kubernetes services
   */
  constructor(logger: Logger, kubeNode: KubeNode, icinga: Icinga, options: ServiceOptions=defaults) {
    super();
    this.logger = logger;
    this.icinga = icinga;
    let clone = JSON.parse(JSON.stringify(defaults));
    Object.assign(clone.ClusterIP, options.ClusterIP);
    Object.assign(clone.NodePort, options.NodePort);
    Object.assign(clone.LoadBalancer, options.LoadBalancer);
    this.options = clone;
    this.kubeNode = kubeNode;
  }

  /**
   * Apply host
   */
  protected async applyHost(name: string, address: string, type: string, metadata, templates: string[]): Promise<boolean> {
    let definition = {
      'display_name': name,
      'address': address,
      'check_command': 'dummy',
      'vars.dummy_state': 0,
      'vars._kubernetes': true,
      'vars.kubernetes': metadata,
    };

    Object.assign(definition, this.options[type].hostDefinition);
    return this.icinga.applyHost(name, definition, templates);
  }

  /**
   * Apply service
   */
  protected async applyService(host: string, name: string, type: string, definition, templates: string[]) {
    if (type === Service.TYPE_NODEPORT) {
      for (const node of this.kubeNode.getWorkerNodes()) {
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

    if (!this.options[serviceType]) {
      throw new Error('unknown service type provided');
    }

    let options = this.options[serviceType];
    let service = JSON.parse(JSON.stringify(options.serviceDefinition));
    service['groups'] = [definition.metadata.namespace];
    Object.assign(service, this.prepareResource(definition));

    let hostname = this.getHostname(definition);
    let templates = options.serviceTemplates;
    templates = templates.concat(this.prepareTemplates(definition));

    if (serviceType !== Service.TYPE_NODEPORT) {
      let address = options.hostName || definition.spec.clusterIP;
      await this.applyHost(hostname, address, serviceType, definition, options.hostTemplates);
    }

    if (options.applyServices) {
      await this.icinga.applyServiceGroup(definition.metadata.namespace);

      for (const servicePort of definition.spec.ports) {
        let port = JSON.parse(JSON.stringify(service));
        if (port.check_command) {
          let hasCommand = await this.icinga.hasCheckCommand(port.check_command);
          if (hasCommand) {
            this.logger.debug('service can be checked via check command '+port.check_command);

            if (serviceType !== Service.TYPE_NODEPORT) {
              port['vars.'+port.check_command+'_address'] = definition.spec.clusterIP;
            }

            port['vars.'+port.check_command+'_port'] = servicePort.nodePort || servicePort.port;
          } else {
            delete port.check_command;
            this.logger.warn('service can not be checked via check command '+port.check_command+', icinga check command does not exists, fallback to service protocol '+servicePort.protocol);
          }
        }

        let protocol = servicePort.protocol.toLowerCase();
        let portName = servicePort.name || protocol+':'+servicePort.port;

        if (!port.check_command) {
          port.check_command = protocol;

          if (serviceType !== Service.TYPE_NODEPORT) {
            port['vars.'+protocol+'_address'] = definition.spec.clusterIP;
          }

          port['vars.'+protocol+'_port'] = servicePort.nodePort || servicePort.port;
        }

        port['vars._kubernetes'] = true;
        port['vars.kubernetes'] = definition;
        let name = this.escapeName([definition.metadata.namespace, definition.metadata.name, portName].join('-'));
        port['display_name'] = name;

        this.applyService(hostname, name, serviceType, port, templates);
      }
    }
  }

  /**
   * Get hostname
   */
  protected getHostname(definition: any): string {
    let serviceType = definition.spec.type;

    if (definition.metadata.annotations['kube-icinga/host']) {
      return definition.metadata.annotations['kube-icinga/host'];
    } else if (this.options[serviceType].hostName === null) {
      return this.escapeName(['service', definition.metadata.namespace, definition.metadata.name].join('-'));
    }

    return this.options[serviceType].hostName;
  }

  /**
   * Delete object
   */
  protected deleteObject(definition: any): Promise<boolean> {
    let serviceType = definition.spec.type;

    if (this.options[serviceType].hostName === null) {
      let hostname = this.getHostname(definition);
      return this.icinga.deleteHost(hostname);
    }

    return this.icinga.deleteServicesByFilter('service.vars.kubernetes.metadata.uid=="'+definition.metadata.uid+'"');
  }

  /**
   * Start kube listener
   */
  public async kubeListener(provider) {
    try {
      let stream = provider();
      stream.on('data', async (object) => {
        this.logger.debug('received kubernetes service resource', {object});

        if (object.object.kind !== 'Service') {
          this.logger.error('skip invalid service object', {object: object});
          return;
        }

        if (!this.options[object.object.spec.type].discover) {
          this.logger.debug('skip service object, since ['+object.object.spec.type+'] is not enabled for discover', {object: object});
          return;
        }

        if (object.type == 'MODIFIED' || object.type == 'DELETED') {
          await this.deleteObject(object.object).catch((err) => {
            this.logger.error('failed to remove objects', {error: err});
          });
        }

        if (object.type == 'ADDED' || object.type == 'MODIFIED') {
          this.prepareObject(object.object).catch((err) => {
            this.logger.error('failed to handle resource', {error: err});
          });
        }
      });

      stream.on('finish', () => {
        this.kubeListener(provider);
      });
    } catch (err) {
      this.logger.error('failed start services listener', {error: err});
    }
  }
}
