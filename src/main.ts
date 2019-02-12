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
const kubeNode = new Node(logger, kubeClient, icinga, new JSONStream(), config.kubernetes.nodes);
const kubeIngress = new Ingress(logger, kubeNode, kubeClient, icinga, new JSONStream(), config.kubernetes.ingresses);
const kubeService = new Service(logger, kubeNode, kubeClient, icinga, new JSONStream(), config.kubernetes.services);
const kubeVolume = new Volume(logger, kubeNode, kubeClient, icinga, new JSONStream(), config.kubernetes.volumes);

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
  //    kubeNode.kubeListener();
  }

  if (config.kubernetes.ingresses.discover) {
  //  kubeIngress.kubeListener();
  }
  
  if (config.kubernetes.volumes.discover) {
    kubeVolume.kubeListener();
  }

  if (config.kubernetes.services.ClusterIP.discover
  || config.kubernetes.services.NodePort.discover
  || config.kubernetes.services.LoadBalancer.discover) {
  //  kubeService.kubeListener();
  }
}

main();
