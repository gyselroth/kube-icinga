let defaultConfig;

try {
  defaultConfig = require('../config.json');
} catch (Error) {
  console.error(Error);
  defaultConfig = {};
}

const config = {
  log: {
    level: process.env.LOG_LEVEL || defaultConfig.log.level,
  },
  cleanup: process.env.CLEANUP || defaultConfig.cleanup,
  icinga: {
    address: process.env.ICINGA_ADDRESS || defaultConfig.icinga.address,
    port: process.env.ICINGA_PORT || defaultConfig.icinga.port,
    apiUser: process.env.ICINGA_API_USERNAME || defaultConfig.icinga.apiUser,
    apiPassword: process.env.ICINGA_API_PASSWORD || defaultConfig.icinga.apiPassword,
  },
  kubernetes: {
    nodes: {
      discover: process.env.KUBERNETES_NODES_DISCOVER || defaultConfig.kubernetes.nodes.discover,
      hostDefinition: process.env.KUBERNETES_NODES_HOST_DEFINITION || defaultConfig.kubernetes.nodes.hostDefinition,
      hostTemplates: process.env.KUBERNETES_NODES_HOST_TEMPLATES || defaultConfig.kubernetes.nodes.hostTemplates,
    },
    ingresses: {
      discover: process.env.KUBERNETES_INGRESSES_DISCOVER || defaultConfig.kubernetes.ingresses.discover,
      hostName: process.env.KUBERNETES_INGRESSES_HOSTNAME || defaultConfig.kubernetes.ingresses.hostName,
      applyServices: process.env.KUBERNETES_INGRESSES_APPLYSERVICES || defaultConfig.kubernetes.ingresses.applyServices,
      serviceDefinition: process.env.KUBERNETES_INGRESSES_SERVICE_DEFINITION || defaultConfig.kubernetes.ingresses.serviceDefinition,
      hostDefinition: process.env.KUBERNETES_INGRESSES_HOST_DEFINITION || defaultConfig.kubernetes.ingresses.hostDefinition,
      serviceTemplates: process.env.KUBERNETES_INGRESSES_SERVICE_TEMPLATES || defaultConfig.kubernetes.ingresses.serviceTemplates,
      hostTemplates: process.env.KUBERNETES_INGRESSES_HOST_TEMPLATES || defaultConfig.kubernetes.ingresses.hostTemplates,
      attachToNodes: process.env.KUBERNETES_INGRESSES_ATTACHTONODES || defaultConfig.kubernetes.ingresses.attachToNodes,
    },
    volumes: {
      discover: process.env.KUBERNETES_VOLUMES_DISCOVER || defaultConfig.kubernetes.volumes.discover,
      hostName: process.env.KUBERNETES_VOLUMES_HOSTNAME || defaultConfig.kubernetes.volumes.hostName,
      applyServices: process.env.KUBERNETES_VOLUMES_APPLYSERVICES || defaultConfig.kubernetes.volumes.applyServices,
      serviceDefinition: process.env.KUBERNETES_VOLUMES_SERVICE_DEFINITION || defaultConfig.kubernetes.volumes.serviceDefinition,
      hostDefinition: process.env.KUBERNETES_VOLUMES_HOST_DEFINITION || defaultConfig.kubernetes.volumes.hostDefinition,
      serviceTemplates: process.env.KUBERNETES_VOLUMES_SERVICE_TEMPLATES || defaultConfig.kubernetes.volumes.serviceTemplates,
      hostTemplates: process.env.KUBERNETES_VOLUMES_HOST_TEMPLATES || defaultConfig.kubernetes.volumes.hostTemplates,
      attachToNodes: process.env.KUBERNETES_VOLUMES_ATTACHTONODES || defaultConfig.kubernetes.volumes.attachToNodes,
    },
    services: {
      ClusterIP: {
        discover: process.env.KUBERNETES_SERVICES_CLUSTERIP_DISCOVER || defaultConfig.kubernetes.services.ClusterIP.discover,
        hostName: process.env.KUBERNETES_SERVICES_CLUSTERIP_HOSTNAME || defaultConfig.kubernetes.services.ClusterIP.hostName,
        applyServices: process.env.KUBERNETES_SERVICES_CLUSTERIP_APPLYSERVICES || defaultConfig.kubernetes.services.ClusterIP.applyServices,
        serviceDefinition: process.env.KUBERNETES_SERVICES_CLUSTERIP_SERVICE_DEFINITION || defaultConfig.kubernetes.services.ClusterIP.serviceDefinition,
        hostDefinition: process.env.KUBERNETES_SERVICES_CLUSTERIP_HOST_DEFINITION || defaultConfig.kubernetes.services.ClusterIP.hostDefinition,
        serviceTemplates: process.env.KUBERNETES_SERVICES_CLUSTERIP_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.ClusterIP.serviceTemplates,
        hostTemplates: process.env.KUBERNETES_SERVICES_CLUSTERIP_HOST_TEMPLATES || defaultConfig.kubernetes.services.ClusterIP.hostTemplates,
      },
      NodePort: {
        discover: process.env.KUBERNETES_SERVICES_NODEPORT_DISCOVER || defaultConfig.kubernetes.services.NodePort.discover,
        hostName: process.env.KUBERNETES_SERVICES_NODEPORT_HOSTNAME || defaultConfig.kubernetes.services.NodePort.hostName,
        applyServices: process.env.KUBERNETES_SERVICES_NODEPORT_APPLYSERVICES || defaultConfig.kubernetes.services.NodePort.applyServices,
        serviceDefinition: process.env.KUBERNETES_SERVICES_NODEPORT_SERVICE_DEFINITION || defaultConfig.kubernetes.services.NodePort.serviceDefinition,
        hostDefinition: process.env.KUBERNETES_SERVICES_NODEPORT_HOST_DEFINITION || defaultConfig.kubernetes.services.NodePort.hostDefinition,
        serviceTemplates: process.env.KUBERNETES_SERVICES_NODEPORT_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.NodePort.serviceTemplates,
        hostTemplates: process.env.KUBERNETES_SERVICES_NODEPORT_HOST_TEMPLATES || defaultConfig.kubernetes.services.NodePort.hostTemplates,
      },
      LoadBalancer: {
        discover: process.env.KUBERNETES_SERVICES_LOADBALANCER_DISCOVER || defaultConfig.kubernetes.services.LoadBalancer.discover,
        hostName: process.env.KUBERNETES_SERVICES_LOADBALANCER_HOSTNAME || defaultConfig.kubernetes.services.LoadBalancer.hostName,
        applyServices: process.env.KUBERNETES_SERVICES_LOADBALANCER_APPLYSERVICES || defaultConfig.kubernetes.services.LoadBalancer.applyServices,
        serviceDefinition: process.env.KUBERNETES_SERVICES_LOADBALANCER_SERVICE_DEFINITION || defaultConfig.kubernetes.services.LoadBalancer.serviceDefinition,
        hostDefinition: process.env.KUBERNETES_SERVICES_LOADBALANCER_HOST_DEFINITION || defaultConfig.kubernetes.services.LoadBalancer.hostDefinition,
        serviceTemplates: process.env.KUBERNETES_SERVICES_LOADBALANCER_SERVICE_TEMPLATES || defaultConfig.kubernetes.services.LoadBalancer.serviceTemplates,
        hostTemplates: process.env.KUBERNETES_SERVICES_LOADBALANCER_HOST_TEMPLATES || defaultConfig.kubernetes.services.LoadBalancer.hostTemplates,
      },
    },
  },
};

export default config;
