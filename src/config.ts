let defaultConfig;

try {
  defaultConfig = require('../config.json');
} catch (Error) {
  console.error(Error);
  defaultConfig = {};
}

const config = {
  log: {
    level: process.env.LOG_LEVEL || defaultConfig.log.level || 'info',
  },
  cleanup: process.env.CLEANUP || defaultConfig.cleanup || true,
  icinga: {
    address: process.env.ICINGA_ADDRESS || defaultConfig.icinga.address || '127.0.0.1',
    port: process.env.ICINGA_PORT || defaultConfig.icinga.port || '5661',
    apiUser: process.env.ICINGA_API_USERNAME || defaultConfig.icinga.apiUser || 'admin',
    apiPassword: process.env.ICINGA_API_PASSWORD || defaultConfig.icinga.apiPassword || 'admin',
  },
  kubernetes: {
    nodes: {
      discover: process.env.KUBERNETES_NODES_DISCOVER || defaultConfig.kubernetes.nodes.discover || true,
      hostDefinition: process.env.KUBERNETES_NODES_HOST_DEFINITION || defaultConfig.kubernetes.nodes.hostDefinition || {},
      hostTemplates: process.env.KUBERNETES_NODES_HOST_TEMPLATES || defaultConfig.kubernetes.nodes.hostTemplates || ['generic-host'],
    },
    ingresses: {
      discover: process.env.KUBERNETES_INGRESSES_DISCOVER || defaultConfig.kubernetes.ingresses.discover || true,
      applyServices: process.env.KUBERNETES_INGRESSES_APPLYSERVICES || defaultConfig.kubernetes.ingresses.applyServices || true,
      serviceDefinition: process.env.KUBERNETES_INGRESSES_SERVICE_DEFINITION || defaultConfig.kubernetes.ingresses.serviceDefinition || {},
      hostDefinition: process.env.KUBERNETES_INGRESSES_HOST_DEFINITION || defaultConfig.kubernetes.ingresses.hostDefinition || {},
      serviceTemplates: process.env.KUBERNETES_INGRESSES_SERVICE_TEMPLATES || defaultConfig.kubernetes.ingresses.serviceTemplates || ['generic-service'],
      hostTemplates: process.env.KUBERNETES_INGRESSES_HOST_TEMPLATES || defaultConfig.kubernetes.ingresses.hostTemplates || ['generic-host'],
      attachToNodes: process.env.KUBERNETES_INGRESSES_ATTACHTONODES || defaultConfig.kubernetes.ingresses.attachToNodes || false,
    },
    volumes: {
      discover: process.env.KUBERNETES_INGRESSES_DISCOVER || defaultConfig.kubernetes.volumes.discover || true,
      applyServices: process.env.KUBERNETES_INGRESSES_APPLYSERVICES || defaultConfig.kubernetes.volumes.applyServices || true,
      serviceDefinition: process.env.KUBERNETES_INGRESSES_SERVICE_DEFINITION || defaultConfig.kubernetes.volumes.serviceDefinition || {},
      hostDefinition: process.env.KUBERNETES_INGRESSES_HOST_DEFINITION || defaultConfig.kubernetes.volumes.hostDefinition || {},
      serviceTemplates: process.env.KUBERNETES_INGRESSES_SERVICE_TEMPLATES || defaultConfig.kubernetes.volumes.serviceTemplates || ['generic-service'],
      hostTemplates: process.env.KUBERNETES_INGRESSES_HOST_TEMPLATES || defaultConfig.kubernetes.volumes.hostTemplates || ['generic-host'],
      attachToNodes: process.env.KUBERNETES_INGRESSES_ATTACHTONODES || defaultConfig.kubernetes.volumes.attachToNodes || false,
    },
    services: {
      ClusterIP: {
        discover: process.env.KUBERNETES_SERVICES_CLUSTERIP_DISCOVER || defaultConfig.kubernetes.services.ClusterIP.discover || false,
        applyServices: process.env.KUBERNETES_SERVICES_CLUSTERIP_APPLYSERVICES || defaultConfig.kubernetes.services.ClusterIP.applyServices || true,
        serviceDefinition: process.env.KUBERNETES_SERVICES_CLUSTERIP_SERVICE_DEFINITION || defaultConfig.kubernetes.services.ClusterIP.serviceDefinition || {},
        hostDefinition: process.env.KUBERNETES_SERVICES_CLUSTERIP_HOST_DEFINITION || defaultConfig.kubernetes.services.ClusterIP.hostDefinition || {},
        serviceTemplates: process.env.KUBERNETES_SERVICES_CLUSTERIP_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.ClusterIP.serviceTemplates || ['generic-service'],
        hostTemplates: process.env.KUBERNETES_SERVICES_CLUSTERIP_HOST_TEMPLATES || defaultConfig.kubernetes.services.ClusterIP.hostTemplates || ['generic-host'],
      },
      NodePort: {
        discover: process.env.KUBERNETES_SERVICES_NODEPORT_DISCOVER || defaultConfig.kubernetes.services.NodePort.discover || true,
        applyServices: process.env.KUBERNETES_SERVICES_NODEPORT_APPLYSERVICES || defaultConfig.kubernetes.services.NodePort.applyServices || true,
        serviceDefinition: process.env.KUBERNETES_SERVICES_NODEPORT_SERVICE_DEFINITION || defaultConfig.kubernetes.services.NodePort.serviceDefinition || {},
        hostDefinition: process.env.KUBERNETES_SERVICES_NODEPORT_HOST_DEFINITION || defaultConfig.kubernetes.services.NodePort.hostDefinition || {},
        serviceTemplates: process.env.KUBERNETES_SERVICES_NODEPORT_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.NodePort.serviceTemplates || ['generic-service'],
        hostTemplates: process.env.KUBERNETES_SERVICES_NODEPORT_HOST_TEMPLATES || defaultConfig.kubernetes.services.NodePort.hostTemplates || ['generic-host'],
      },
      LoadBalancer: {
        discover: process.env.KUBERNETES_SERVICES_LOADBALANCER_DISCOVER || defaultConfig.kubernetes.services.LoadBalancer.discover || true,
        applyServices: process.env.KUBERNETES_SERVICES_LOADBALANCER_APPLYSERVICES || defaultConfig.kubernetes.services.LoadBalancer.applyServices || true,
        serviceDefinition: process.env.KUBERNETES_SERVICES_LOADBALANCER_SERVICE_DEFINITION || defaultConfig.kubernetes.services.LoadBalancer.serviceDefinition || {},
        hostDefinition: process.env.KUBERNETES_SERVICES_LOADBALANCER_HOST_DEFINITION || defaultConfig.kubernetes.services.LoadBalancer.hostDefinition || {},
        serviceTemplates: process.env.KUBERNETES_SERVICES_LOADBALANCER_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.LoadBalancer.serviceTemplates || ['generic-service'],
        hostTemplates: process.env.KUBERNETES_SERVICES_LOADBALANCER_HOST_TEMPLATES || defaultConfig.kubernetes.services.LoadBalancer.hostTemplates || ['generic-host'],
      },
    },
  },
};

export default config;
