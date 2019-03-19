let defaultConfig;

try {
  defaultConfig = require('../config.json');
} catch (Error) {
  console.error(Error);
  defaultConfig = {};
}

/**
 * Decode json
 */
function jsonParse(name: string, value) {
  if (process.env[name]) {
    return JSON.parse(process.env[name]);
  }

  return value;
}

/**
 * Comma separated string to array
 */
function split(name: string, value) {
  if (process.env[name]) {
    return process.env[name].split(',');
  }

  return value;
}

/**
 * Parse env string
 */
function stringParse(name: string, value) {
  if (process.env[name]) {
    if (process.env[name] == '') {
      return null;
    }

    return process.env[name];
  }

  return value;
}

const config = {
  log: {
    level: process.env.LOG_LEVEL || defaultConfig.log.level,
  },
  cleanup: jsonParse('CLEANUP', defaultConfig.cleanup),
  icinga: {
    address: process.env.ICINGA_ADDRESS || defaultConfig.icinga.address,
    port: process.env.ICINGA_PORT || defaultConfig.icinga.port,
    apiUser: process.env.ICINGA_API_USERNAME || defaultConfig.icinga.apiUser,
    apiPassword: process.env.ICINGA_API_PASSWORD || defaultConfig.icinga.apiPassword,
  },
  kubernetes: {
    nodes: {
      discover: jsonParse('KUBERNETES_NODES_DISCOVER', defaultConfig.kubernetes.nodes.discover),
      hostDefinition: jsonParse('KUBERNETES_NODES_HOST_DEFINITION', defaultConfig.kubernetes.nodes.hostDefinition),
      hostTemplates: jsonParse('KUBERNETES_NODES_HOST_TEMPLATES', defaultConfig.kubernetes.nodes.hostTemplates),
    },
    ingresses: {
      discover: jsonParse('KUBERNETES_INGRESSES_DISCOVER', defaultConfig.kubernetes.ingresses.discover),
      hostName: stringParse('KUBERNETES_INGRESSES_HOSTNAME', defaultConfig.kubernetes.ingresses.hostName),
      applyServices: jsonParse('KUBERNETES_INGRESSES_APPLYSERVICES', defaultConfig.kubernetes.ingresses.applyServices),
      serviceDefinition: jsonParse('KUBERNETES_INGRESSES_SERVICE_DEFINITION', defaultConfig.kubernetes.ingresses.serviceDefinition),
      serviceGroupDefinition: jsonParse('KUBERNETES_NAMESPACES_SERVICEGROUP_DEFINITION', defaultConfig.kubernetes.namespaces.serviceGroupDefinition),
      hostDefinition: jsonParse('KUBERNETES_INGRESSES_HOST_DEFINITION', defaultConfig.kubernetes.ingresses.hostDefinition),
      serviceTemplates: split('KUBERNETES_INGRESSES_SERVICE_TEMPLATES', defaultConfig.kubernetes.ingresses.serviceTemplates),
      hostTemplates: split('KUBERNETES_INGRESSES_HOST_TEMPLATES', defaultConfig.kubernetes.ingresses.hostTemplates),
      attachToNodes: jsonParse('KUBERNETES_INGRESSES_ATTACHTONODES', defaultConfig.kubernetes.ingresses.attachToNodes),
    },
    volumes: {
      discover: jsonParse('KUBERNETES_VOLUMES_DISCOVER', defaultConfig.kubernetes.volumes.discover),
      hostName: stringParse('KUBERNETES_VOLUMES_HOSTNAME', defaultConfig.kubernetes.volumes.hostName),
      applyServices: jsonParse('KUBERNETES_VOLUMES_APPLYSERVICES', defaultConfig.kubernetes.volumes.applyServices),
      serviceDefinition: jsonParse('KUBERNETES_VOLUMES_SERVICE_DEFINITION', defaultConfig.kubernetes.volumes.serviceDefinition),
      serviceGroupDefinition: jsonParse('KUBERNETES_NAMESPACES_SERVICEGROUP_DEFINITION', defaultConfig.kubernetes.namespaces.serviceGroupDefinition),
      hostDefinition: jsonParse('KUBERNETES_VOLUMES_HOST_DEFINITION', defaultConfig.kubernetes.volumes.hostDefinition),
      serviceTemplates: split('KUBERNETES_VOLUMES_SERVICE_TEMPLATES', defaultConfig.kubernetes.volumes.serviceTemplates),
      hostTemplates: split('KUBERNETES_VOLUMES_HOST_TEMPLATES', defaultConfig.kubernetes.volumes.hostTemplates),
      attachToNodes: jsonParse('KUBERNETES_VOLUMES_ATTACHTONODES', defaultConfig.kubernetes.volumes.attachToNodes),
    },
    services: {
      ClusterIP: {
        discover: jsonParse('KUBERNETES_SERVICES_CLUSTERIP_DISCOVER', defaultConfig.kubernetes.services.ClusterIP.discover),
        hostName: stringParse('KUBERNETES_SERVICES_CLUSTERIP_HOSTNAME', defaultConfig.kubernetes.services.ClusterIP.hostName),
        applyServices: jsonParse('KUBERNETES_SERVICES_CLUSTERIP_APPLYSERVICES', defaultConfig.kubernetes.services.ClusterIP.applyServices),
        serviceDefinition: jsonParse('KUBERNETES_SERVICES_CLUSTERIP_SERVICE_DEFINITION', defaultConfig.kubernetes.services.ClusterIP.serviceDefinition),
        serviceGroupDefinition: jsonParse('KUBERNETES_NAMESPACES_SERVICEGROUP_DEFINITION', defaultConfig.kubernetes.namespaces.serviceGroupDefinition),
        hostDefinition: jsonParse('KUBERNETES_SERVICES_CLUSTERIP_HOST_DEFINITION', defaultConfig.kubernetes.services.ClusterIP.hostDefinition),
        serviceTemplates: split('KUBERNETES_SERVICES_CLUSTERIP_SERVICE_TEMPLATES', defaultConfig.kubernetes.services.ClusterIP.serviceTemplates),
        hostTemplates: split('KUBERNETES_SERVICES_CLUSTERIP_HOST_TEMPLATES', defaultConfig.kubernetes.services.ClusterIP.hostTemplates),
      },
      NodePort: {
        discover: jsonParse('KUBERNETES_SERVICES_NODEPORT_DISCOVER', defaultConfig.kubernetes.services.NodePort.discover),
        hostName: jsonParse('KUBERNETES_SERVICES_NODEPORT_HOSTNAME', defaultConfig.kubernetes.services.NodePort.hostName),
        applyServices: jsonParse('KUBERNETES_SERVICES_NODEPORT_APPLYSERVICES', defaultConfig.kubernetes.services.NodePort.applyServices),
        serviceDefinition: jsonParse('KUBERNETES_SERVICES_NODEPORT_SERVICE_DEFINITION', defaultConfig.kubernetes.services.NodePort.serviceDefinition),
        serviceGroupDefinition: jsonParse('KUBERNETES_NAMESPACES_SERVICEGROUP_DEFINITION', defaultConfig.kubernetes.namespaces.serviceGroupDefinition),
        hostDefinition: jsonParse('KUBERNETES_SERVICES_NODEPORT_HOST_DEFINITION', defaultConfig.kubernetes.services.NodePort.hostDefinition),
        serviceTemplates: split('KUBERNETES_SERVICES_NODEPORT_SERVICE_TEMPLATES', defaultConfig.kubernetes.services.NodePort.serviceTemplates),
        hostTemplates: split('KUBERNETES_SERVICES_NODEPORT_HOST_TEMPLATES', defaultConfig.kubernetes.services.NodePort.hostTemplates),
      },
      LoadBalancer: {
        discover: jsonParse('KUBERNETES_SERVICES_LOADBALANCER_DISCOVER', defaultConfig.kubernetes.services.LoadBalancer.discover),
        hostName: stringParse('KUBERNETES_SERVICES_LOADBALANCER_HOSTNAME', defaultConfig.kubernetes.services.LoadBalancer.hostName),
        applyServices: jsonParse('KUBERNETES_SERVICES_LOADBALANCER_APPLYSERVICES', defaultConfig.kubernetes.services.LoadBalancer.applyServices),
        serviceDefinition: jsonParse('KUBERNETES_SERVICES_LOADBALANCER_SERVICE_DEFINITION', defaultConfig.kubernetes.services.LoadBalancer.serviceDefinition),
        serviceGroupDefinition: jsonParse('KUBERNETES_NAMESPACES_SERVICEGROUP_DEFINITION', defaultConfig.kubernetes.namespaces.serviceGroupDefinition),
        hostDefinition: jsonParse('KUBERNETES_SERVICES_LOADBALANCER_HOST_DEFINITION', defaultConfig.kubernetes.services.LoadBalancer.hostDefinition),
        serviceTemplates: split('KUBERNETES_SERVICES_LOADBALANCER_SERVICE_TEMPLATES', defaultConfig.kubernetes.services.LoadBalancer.serviceTemplates),
        hostTemplates: split('KUBERNETES_SERVICES_LOADBALANCER_HOST_TEMPLATES', defaultConfig.kubernetes.services.LoadBalancer.hostTemplates),
      },
    },
  },
};

export default config;
