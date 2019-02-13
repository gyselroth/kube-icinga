import logger from './logger';
import kubeClient from './client/kube';
import icingaClient from './client/icinga';
import IcingaWrapper from './icinga';
import config from './config';
import Node from './kube/node';
import Service from './kube/service';
import Ingress from './kube/ingress';
import Volume from './kube/volume';
import * as JSONStream from 'json-stream';

const icinga = new IcingaWrapper(logger, icingaClient);
const kubeNode = new Node(logger, icinga, new JSONStream(), config.kubernetes.nodes);
const kubeIngress = new Ingress(logger, kubeNode, icinga, new JSONStream(), config.kubernetes.ingresses);
const kubeService = new Service(logger, kubeNode, icinga, new JSONStream(), config.kubernetes.services);
const kubeVolume = new Volume(logger, kubeNode, icinga, new JSONStream(), config.kubernetes.volumes);

/**
 * Main
 */
async function main() {
  if (config.cleanup) {
    await icinga.cleanup().catch(err => {
      logger.error('failed to cleanup icinga objects', {error: err});
    });
  }

  if (config.kubernetes.nodes.discover) {
    kubeNode.kubeListener(() => {
      return kubeClient.apis.v1.watch.nodes.getStream();
    });
  }
  
  if (config.kubernetes.ingresses.discover) {
    kubeIngress.kubeListener(() => {
      return kubeClient.apis.extensions.v1beta1.watch.ingresses.getStream();    
    });
  }
  
  if (config.kubernetes.volumes.discover) {
    kubeVolume.kubeListener(() => {
      return kubeClient.apis.v1.watch.persistentvolumes.getStream();
    });
  }

  if (config.kubernetes.services.ClusterIP.discover
  || config.kubernetes.services.NodePort.discover
  || config.kubernetes.services.LoadBalancer.discover) {
    kubeService.kubeListener(() => {
      return kubeClient.apis.v1.watch.services.getStream();
    });
  }
}

main();
