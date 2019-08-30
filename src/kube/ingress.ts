import {Logger} from 'winston';
import {Icinga, IcingaObject} from '../icinga';
import KubeNode from './node';
import {default as AbstractResource} from './abstract.resource';
import {providerStream} from '../client/kube';
import {Ingress as KubeIngress, HTTPIngressRuleValue} from 'kubernetes-types/extensions/v1beta1';

interface IngressOptions {
  discover: boolean;
  hostName: string;
  applyServices: boolean;
  attachToNodes: boolean;
  hostDefinition: object;
  serviceDefinition: object;
  serviceGroupDefinition: object;
  hostTemplates: string[];
  serviceTemplates: string[];
}

interface WatchEvent {
  type: string;
  object: KubeIngress;
}

const DefaultOptions: IngressOptions = {
  discover: true,
  applyServices: true,
  hostName: 'kubernetes-ingresses',
  attachToNodes: false,
  hostDefinition: {},
  serviceDefinition: {},
  serviceGroupDefinition: {},
  hostTemplates: [],
  serviceTemplates: [],
};

/**
 * kubernetes ingresses
 */
export default class Ingress extends AbstractResource {
  protected icinga: Icinga;
  protected kubeNode: KubeNode;
  protected options: IngressOptions = DefaultOptions;

  /**
   * kubernetes hosts
   */
  constructor(logger: Logger, kubeNode: KubeNode, icinga: Icinga, options: any = DefaultOptions) {
    super(logger);
    this.logger = logger;
    this.icinga = icinga;
    this.kubeNode = kubeNode;
    this.options = Object.assign({}, this.options, options);
  }

  /**
   * Apply host
   */
  protected async applyHost(name: string, address: string, metadata: KubeIngress, templates: string[]): Promise<boolean> {
    let definition: IcingaObject = {
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
  protected async applyService(host: string, name: string, definition: any, templates: string[]) {
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
  public async prepareObject(definition: KubeIngress): Promise<any> {
    let hostname = this.getHostname(definition);

    if (!this.options.attachToNodes) {
      await this.applyHost(hostname, hostname, definition, this.options.hostTemplates);
    }

    let service = this.prepareResource(definition);
    let templates = this.options.serviceTemplates;
    templates = templates.concat(this.prepareTemplates(definition));

    if (this.options.applyServices) {
      let groups = [];
      if (definition.metadata && definition.metadata.namespace) {
        groups.push(definition.metadata.namespace);
        await this.icinga.applyServiceGroup(definition.metadata.namespace, Object.assign({'vars._kubernetes': true}, this.options.serviceGroupDefinition));
      }

      for (const spec of ((definition.spec || {}).rules || [])) {
        for (const path of ((spec.http || {} as HTTPIngressRuleValue).paths || [])) {
          let base = path.path || '/';
          let name = this.escapeName([spec.host, 'http', base].join('-'));
          let addition: IcingaObject = {
            'check_command': 'http',
            'display_name': `${spec.host}${base}:http`,
            'vars._kubernetes': true,
            'vars._kubernetes_uid': (definition.metadata || {}).uid || null,
            'vars.kubernetes': definition,
            'vars.http_address': spec.host,
            'vars.http_vhost': spec.host,
            'vars.http_path': base,
            'vars.http_ignore_body': true,
            'groups': groups,
          };

          Object.assign(addition, this.options.serviceDefinition);
          Object.assign(addition, service);
          this.applyService(hostname, name, addition, templates);

          // tls secret set, also apply https service
          if ((definition.spec || {}).tls || false) {
            name = this.escapeName([spec.host, 'https', base].join('-'));
            addition.display_name += 's';
            addition['vars.http_ssl'] = true;
            this.applyService(hostname, name, addition, templates);
          }
        }
      }
    }
  }

  /**
   * Get hostname
   */
  protected getHostname(definition: KubeIngress): string {
    let annotations = this.getAnnotations(definition);

    if (annotations['kube-icinga/host']) {
      return annotations['kube-icinga/host'];
    } else if (this.options.hostName === null) {
      return this.escapeName(['ingress', definition.metadata!.namespace, definition.metadata!.name].join('-'));
    }

    return this.options.hostName;
  }

  /**
   * Delete object
   */
  protected deleteObject(definition: KubeIngress): Promise<boolean> {
    if (this.options.hostName === null) {
      let hostname = this.getHostname(definition);
      return this.icinga.deleteHost(hostname);
    }

    return this.icinga.deleteServicesByFilter('service.vars.kubernetes.metadata.uid=="'+definition.metadata!.uid+'"');
  }

  /**
   * Start kube listener
   */
  public async kubeListener(provider: providerStream) {
    try {
      let stream = provider();
      stream.on('data', async (object: WatchEvent) => {
        this.logger.debug('received kubernetes ingress resource', {object});
        return this.handleResource('Ingress', object, this.options);
      });

      stream.on('finish', () => {
        this.kubeListener(provider);
      });
    } catch (err) {
      this.logger.error('failed start ingresses listener', {error: err});
    }
  }
}
