import {Logger} from 'winston';
import {Icinga, IcingaObject} from '../icinga';
import KubeNode from './node';
import {default as AbstractResource} from './abstract.resource';
import {providerStream} from '../client/kube';
import {Service as KubeService} from 'kubernetes-types/core/v1';

interface ServiceTypeOptions {
  discover?: boolean;
  hostName?: string;
  applyServices?: boolean;
  hostDefinition?: any;
  serviceDefinition?: any;
  serviceGroupDefinition?: any;
  hostTemplates: string[];
  serviceTemplates: string[];
}

interface ServiceOptions {
  [key: string]: ServiceTypeOptions;
}

const DefaultOptions: ServiceOptions = {
  ClusterIP: {
    discover: false,
    hostName: 'kubernetes-clusterip-services',
    applyServices: true,
    hostDefinition: {},
    serviceDefinition: {},
    serviceGroupDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  },
  NodePort: {
    discover: true,
    hostName: 'kubernetes-nodeport-services',
    applyServices: true,
    hostDefinition: {},
    serviceDefinition: {},
    serviceGroupDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  },
  LoadBalancer: {
    discover: true,
    hostName: 'kubernetes-loadbalancer-services',
    applyServices: true,
    hostDefinition: {},
    serviceDefinition: {},
    serviceGroupDefinition: {},
    hostTemplates: [],
    serviceTemplates: [],
  },
};

const TYPE_CLUSTERIP = 'ClusterIP';
const TYPE_NODEPORT = 'NodePort';
const TYPE_LOADBALANCER = 'LoadBalancer';

const PROTOCOL_TCP = 'tcp';

// We can not simply monitor udp services out of the box without manual intervention, therefore udp checks are by default dummies.
const PROTOCOL_MAP: { [key: string]: string } = {
  udp: 'dummy',
};

const HEADLESS_ADDRESS = 'None';

/**
 * kubernetes services
 */
export default class Service extends AbstractResource {
  protected icinga: Icinga;
  protected kubeNode: KubeNode;
  protected options = DefaultOptions;

  /**
   * kubernetes services
   */
  constructor(logger: Logger, kubeNode: KubeNode, icinga: Icinga, options: ServiceOptions=DefaultOptions) {
    super(logger);
    this.icinga = icinga;
    let clone = JSON.parse(JSON.stringify(DefaultOptions));
    Object.assign(clone.ClusterIP, options.ClusterIP);
    Object.assign(clone.NodePort, options.NodePort);
    Object.assign(clone.LoadBalancer, options.LoadBalancer);
    this.options = clone;
    this.kubeNode = kubeNode;
  }

  /**
   * Apply host
   */
  protected async applyHost(name: string, address: string, type: string, metadata: KubeService, templates: string[]): Promise<boolean> {
    let definition: IcingaObject = {

      'display_name': name,
      'address': address,
      'check_command': 'dummy',
      'vars.dummy_state': 0,
      'vars._kubernetes': true,
      'vars.kubernetes': metadata,
    };

    Object.assign(definition, this.getServiceDefinition(type).hostDefinition);
    return this.icinga.applyHost(name, definition, templates);
  }

  /**
   * Apply service
   */
  protected async applyService(host: string, name: string, type: string, definition: any, templates: string[]) {
    if (type === TYPE_NODEPORT) {
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
  public async prepareObject(definition: KubeService): Promise<any> {
    let serviceType = this.getServiceType(definition);

    if (!definition.metadata || !definition.metadata.name) {
      throw new Error('resource name in metadata is required');
    }

    let options = this.getServiceDefinition(serviceType);
    let service = JSON.parse(JSON.stringify(options.serviceDefinition));

    if (definition.metadata && definition.metadata.namespace) {
      service['groups'] = [definition.metadata.namespace];
    }

    Object.assign(service, this.prepareResource(definition));

    let hostname = this.getHostname(definition);
    let templates = options.serviceTemplates;
    templates = templates.concat(this.prepareTemplates(definition));

    if (serviceType !== TYPE_NODEPORT) {
      let address = options.hostName || this.getServiceAddress(definition);
      await this.applyHost(hostname, address, serviceType, definition, options.hostTemplates);
    }

    if (options.applyServices) {
      if (definition.metadata && definition.metadata.namespace) {
        await this.icinga.applyServiceGroup(definition.metadata.namespace, Object.assign({'vars._kubernetes': true}, options.serviceGroupDefinition));
      }

      for (const servicePort of ((definition.spec || {}).ports || [])) {
        let port = JSON.parse(JSON.stringify(service));
        if (port.check_command) {
          let hasCommand = await this.icinga.hasCheckCommand(port.check_command);
          if (hasCommand) {
            this.logger.debug('service can be checked via check command '+port.check_command);

            if (serviceType !== TYPE_NODEPORT) {
              port['vars.'+port.check_command+'_address'] = this.getServiceAddress(definition);
            }

            port['vars.'+port.check_command+'_port'] = servicePort.nodePort || servicePort.port;
          } else {
            delete port.check_command;
            this.logger.warn('service can not be checked via check command '+port.check_command+', icinga check command does not exists, fallback to service protocol '+servicePort.protocol);
          }
        }

        let protocol = (servicePort.protocol || PROTOCOL_TCP).toLowerCase();
        let portName = servicePort.name || protocol+':'+servicePort.port;

        if (!port.check_command && PROTOCOL_MAP[protocol]) {
          this.logger.debug('using check command '+PROTOCOL_MAP[protocol]+', instad '+port.check_command);
          port.check_command = PROTOCOL_MAP[protocol];
        } else if (!port.check_command) {
          port.check_command = protocol;

          if (serviceType !== TYPE_NODEPORT) {
            port['vars.'+protocol+'_address'] = this.getServiceAddress(definition);
          }

          if (serviceType === TYPE_LOADBALANCER) {
            port['vars.'+protocol+'_port'] = servicePort.port || servicePort.nodePort;
          } else {
            port['vars.'+protocol+'_port'] = servicePort.nodePort || servicePort.port;
          }
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
  protected getHostname(definition: KubeService): string {
    let serviceType = this.getServiceType(definition);
    let annotations = this.getAnnotations(definition);
    let service = this.getServiceDefinition(serviceType);

    if (annotations['kube-icinga/host']) {
      return annotations['kube-icinga/host'];
    } else if (!service.hostName) {
      return this.escapeName(['service', definition.metadata!.namespace, definition.metadata!.name].join('-'));
    }

    return service.hostName;
  }

  /**
   * Get service type
   */
  protected getServiceType(definition: KubeService): string {
    let serviceType = TYPE_CLUSTERIP;

    if (definition.spec && definition.spec.type) {
      serviceType = definition.spec.type;
    }

    if (!this.options[serviceType]) {
      throw new Error('unknown service type provided');
    }

    return serviceType;
  }

  /**
   * Get service type
   */
  protected getServiceDefinition(type: string): ServiceTypeOptions {
    if (this.options[type]) {
      return this.options[type];
    }

    throw new Error('unknown service type provided');
  }


  /**
   * Get service ip
   */
  protected getServiceAddress(definition: KubeService): string {
    if (definition.spec) {
      if (definition.spec.loadBalancerIP) {
        return definition.spec.loadBalancerIP;
      } else if (definition.spec.clusterIP) {
        return definition.spec.clusterIP;
      }
    }

    return HEADLESS_ADDRESS;
  }

  /**
   * Delete object
   */
  protected deleteObject(definition: KubeService): Promise<boolean> {
    let serviceType = definition.spec!.type || TYPE_CLUSTERIP;

    if (this.options[serviceType].hostName === null) {
      let hostname = this.getHostname(definition);
      return this.icinga.deleteHost(hostname);
    }

    if (definition.metadata && definition.metadata.uid) {
      return this.icinga.deleteServicesByFilter('service.vars.kubernetes.metadata.uid=="'+definition.metadata.uid+'"');
    }

    return Promise.resolve(false);
  }

  /**
   * Start kube listener
   */
  public async kubeListener(provider: providerStream) {
    try {
      let stream = provider();
      stream.on('data', async (object: any) => {
        this.logger.debug('received kubernetes service resource', {object});

        if (this.getServiceAddress(object.obect) === HEADLESS_ADDRESS) {
          this.logger.info('skip headless service object (use pod provisioning instead)', {object: object});
          return false;
        }

        return this.handleResource('Service', object, this.options[this.getServiceType(object.object)]);
      });

      stream.on('finish', () => {
        this.kubeListener(provider);
      });
    } catch (err) {
      this.logger.error('failed start services listener', {error: err});
    }
  }
}
