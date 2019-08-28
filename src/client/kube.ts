const KubeApi = require('kubernetes-client').Client;
const KubeConfig = require('kubernetes-client').config;

let config;
if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
  config = KubeConfig.getInCluster();
} else {
  config = KubeConfig.fromKubeconfig();
}

export const kubeClient = new KubeApi({config: config, version: '1.9'});

export type providerStream = () => NodeJS.ReadWriteStream;
