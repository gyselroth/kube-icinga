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
const kubeNode = new Node(logger, icinga, config.kubernetes.nodes);
const kubeIngress = new Ingress(logger, kubeNode, icinga, config.kubernetes.ingresses);
const kubeService = new Service(logger, kubeNode, icinga, config.kubernetes.services);
const kubeVolume = new Volume(logger, kubeNode, icinga, config.kubernetes.volumes);

/**
 * Main
 */
async function main() {
  if (config.cleanup) {
    logger.info('cleanup all kube icinga objects (vars._kubernetes == true)');
    
    await icinga.deleteServicesByFilter('service.vars._kubernetes == true').catch((err) => {
      logger.error('failed to cleanup icinga services', {error: err});
    });

    await icinga.deleteHostsByFilter('host.vars._kubernetes == true').catch((err) => {
      logger.error('failed to cleanup icinga hosts', {error: err});
    });
  }

  if (config.kubernetes.nodes.discover) {
    kubeNode.kubeListener(function() {
      let json = new JSONStream();
      let stream = kubeClient.apis.v1.watch.nodes.getStream();
      stream.pipe(json);
      return json;
    });
  }

  if (config.kubernetes.ingresses.discover) {
    kubeIngress.kubeListener(() => {
      let json = new JSONStream();
      let stream = kubeClient.apis.extensions.v1beta1.watch.ingresses.getStream();
      stream.pipe(json);
      return json;
    });
  }

  if (config.kubernetes.volumes.discover) {
    kubeVolume.kubeListener(() => {
      let json = new JSONStream();
      let stream = kubeClient.apis.v1.watch.persistentvolumes.getStream();
      stream.pipe(json);
      return json;
    });
  }

  if (config.kubernetes.services.ClusterIP.discover
  || config.kubernetes.services.NodePort.discover
  || config.kubernetes.services.LoadBalancer.discover) {
    kubeService.kubeListener(() => {
      let json = new JSONStream();
      let stream = kubeClient.apis.v1.watch.services.getStream();
      stream.pipe(json);
      return json;
    });
  }
}

main();
