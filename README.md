# kube-icinga
[![Build Status](https://travis-ci.org/gyselroth/kube-icinga.svg)](https://travis-ci.org/gyselroth/kube-icinga)
[![Coverage Status](https://coveralls.io/repos/github/gyselroth/kube-icinga/badge.svg?branch=master)](https://coveralls.io/github/gyselroth/kube-icinga?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/gyselroth/kube-icinga.svg)](https://github.com/gyselroth/kube-icinga/releases)

kube-icinga automatically deploys icinga objects out of your kubernetes resources.
It has built-in autodiscovery and will work out of the box. However you can change various default configurations and deploy 
custom icinga objects or disable/enable kubernetes objects to monitor.

## How does it work?

Multiple watchers are bootstraped and listen for any kubernetes changes. Those changes will reflect immediately on icinga.

* Kubernetes namespaces will result in icinga service groups and host groups
* Nodes will result in host objects 
* Ingresses will result in dummy icinga host objects [1] (hostname is taken from metadata.name) whereas ingress paths will get deployed as icinga services related to the ingress host object
* Services (ClusterIP, NodePort [2], LoadBalanacer) will also result in icinga host objects and service ports are icinga services.
* Persistent volumes will result in services attached to a dummy host

>**Note**: [1] You may change this behaviour by attaching the services (ingress paths) to all kubernetes worker nodes by setting `kubernetes.ingresses.attachToNodes` to `true`. (This will result in many more services and checks depending on the size of your cluster!)
>**Note**: [2] NodePort services will always be attached to each kubernetes worker node. See [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) services for more information.

Since there is no such thing as hosts in the world of moving and containers. The host object (kubernetes metadata.name) on icinga may just be a [dummy](https://www.icinga.com/docs/icinga2/latest/doc/10-icinga-template-library/#plugin-check-command-dummy) and will not get checked
if the service can not be attached to kubernetes nodes. 

You may wonder where your pods are in this setup. Well it does not make any sense to monitor single pods. Pods are mortal and (always) moving. The important thing is to monitor your services as an entity.

## Table of Contents
* [Description](#description)
* [How does it work?](#how-does-it-work)
* [Requirements](#requirements)
* [Setup icinga2 api user](#setup-icinga2-api-user)
* [Deployment](#deployment)
* [Advanced topics](#advanced-topics)
  * [ClusterIP services](#clusterip-services)
  * [Using icinga2 apply rules](#using-icinga2-apply-rules)
  * [Overwite specific icinga object definition](#overwite-specific-icinga-object-definition)
* [Configuration](#configuration)

## Requirements
* A running kubernetes cluster
* Icinga2 server with enabled API module

## Setup icinga2 api user
kube-icina requires an [icinga api user](https://icinga.com/docs/icinga2/latest/doc/12-icinga2-api/#authentication) which first must be created. 

/etc/icinga2/conf.d/api-users.conf:
```
object ApiUser "kube-icinga" {
  password = "kube-icinga"
  permissions = ["*"]
}
```

## Deployment
The recommended (and logical) way to deploy kube-icinga is deplyoing kube-icinga on kubernetes itself using the [gyselroth/kube-icinga](https://hub.docker.com/r/gyselroth/kube-icinga/) docker image.

The kubernetes deployment can simply be added like this:
```sh
kubectl -f https://raw.githubusercontent.com/gyselroth/kube-icinga/master/kube-icinga.yaml
```
(Change the secret password and ICINGA_ADDRESS value accordingly)


## Advanced topics

### ClusterIP services
Ingresses, NodePort and Load Balancer services will expose your kubernetes services to the public but not ClusterIP services. ClusterIP services (Which is the default) are only internal kubernetes services and not available from outside the cluster. If your icinga2 setup lives outside the cluster you only have to options, either disable deployment for those objects or setup an icinga [satelite](https://www.icinga.com/docs/icinga2/latest/doc/06-distributed-monitoring) container which will live in kubernetes. Of course you may also deploy an entire icinga2 setup on kubernetes if you do not have an existing one.

### Using icinga2 apply rules
You certainly can use icinga2 apply rules. You may disable auto service deployments via `applyServices` for ingresses and services and define your own services via [apply rules](https://www.icinga.com/docs/icinga2/latest/doc/03-monitoring-basics/#using-apply).
Of course you can also setup a mixed deployment. Automatically let kube-icinga deploy services and apply additional services via apply rules. 

>**Note**: Since icinga apply rules are [not triggered](https://www.icinga.com/docs/icinga2/latest/doc/12-icinga2-api/#modifying-objects) if an object gets updated kube-icinga will delete and recreate those objects. 

All icinga host object are created with all kubernetes data available packed in the variable `vars.kubernetes`. Therefore you can apply rules with this data, for example this will create an icinga service for all objects with a kubernetes label foo=bar.

### Globally overwrite icinga object definitions
It is possible to set custom options for the icinga objects during creation. You might set custom values via `kubernetes.ingresses.hostTemplates` or kubernetes.ingresses.serviceTemplate`. The same can also be done for services. For example it might be crucial to set a custom zone for ClusterIP services since they are only reachable within the cluster and shall be monitored by an icinga satelite node. Any valid setting for a specific icinga object can be set.

>**Note** This will set the custom options for all objects from the same type (services.ClusterIP in the follwing example), this may not what you want. Using kubernetes annotations
you may configure custom incinga attributes directly in the kubernetes resource definition.

```json
{
  "kubernetes": {
    "services": {
      "ClusterIP":
        "discover": true,
        "serviceDefiniton": {
          "zone": "my_custom_icinga_zone"
          "vars.a_custom_icinga_variable": ["foo", "bar"]
        },
      }
    }
  }
}
```

### Overwrite icinga object definitions directly in kubernetes resources

kube-icinga is able to parse kubernetes annotations and merge those with its default settings.
You may use the following annotations:

| Name | Description |
| `kube-icinga/check_command` | Use a custom icinga check command. |
| `kube-icinga/template` | Use a custom icinga template. |
| `kube-icinga/definition` | JSON encoded icinga definiton which may contain advanced icinga options and gets merged with the defaults. |


```yaml
kind: PersistentVolume
apiVersion: v1
metadata:
  name: generic-nimble-24afe01f-2300-11e9-94e3-0050568fe3c2,
  selfLink":"/api/v1/persistentvolumes/generic-nimble-24afe01f-2300-11e9-94e3-0050568fe3c2
  uid":"2a66425e-2300-11e9-94e3-0050568fe3c2
  resourceVersion: 65603642
  creationTimestamp: 2019-01-28T13:25:22Z
  annotations:
    kube-icinga/check_command: "check_nimble_lun"
    hpe.com/docker-volume-name": "generic-nimble-24afe01f-2300-11e9-94e3-0050568fe3c2"
    pv.kubernetes.io/provisioned-by: "hpe.com/nimble"
    volume.beta.kubernetes.io/storage-class: "generic-nimble"
```

## Configuration
kube-icinga itself can be configured via environment variables however you may also deploy and change the `config.json` file instead of environment variables.

List of configurable values:

|Setting|Description|Environment Variable| Default Value|
|-------|-----------|--------------------|--------------|
|`log.level`|Loglevel for winston logger|`LOG_LEVEL`|`info`|
|`icinga.address`|Icinga2 address|`ICINGA_ADDRESS`|`127.0.01`|
|`icinga.port`|Icinga2 API port|`ICINGA_PORT`|`5665`|
|`icinga.apiUser`|Icinga2 API username|`ICINGA_API_USERNAME`|`admin`|
|`icinga.apiPassword`|Icinga2 API password|`ICINGA_API_PASSWORD`|`admin`|
|`cleanup`|If `true` all kubernetes objects get removed from icinga at startup|`CLEANUP`|`true`|
|`kubernetes.nodes.discover`|Deploy kubernetes node objects|`KUBERNETES_NODES_DISCOVER`|`true`|
|`kubernetes.nodes.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`ICINGA_NODES_HOST_DEFINITION`|`{}`|
|`kubernetes.nodes.hostTemplates`|Specify a list of host templates|`ICINGA_NODES_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.ingresses.discover`|Deploy kubernetes ingress objects|`KUBERNETES_INGRESSES_DISCOVER`|`true`|
|`kubernetes.ingresses.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`ICINGA_INGRESSES_SERVICE_DEFINITION`|'{}'|
|`kubernetes.ingresses.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`ICINGA_INGRESSES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.ingresses.serviceTemplates`|Specify a list of icinga service templates|`ICINGA_INGRESSES_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.ingresses.hostTemplates`|Specify a list of host templates|`ICINGA_INGRESSES_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.ingresses.applyServices`|Apply ingress paths as icinga services attached to the icinga ingress host|`KUBERNETES_INGRESSES_APPLYSERVICES`|`true`|
|`kubernetes.ingresses.attachToNodes`|If `true` instead attaching port services to a dummy host object `metadata.name` all services get attached to each kubernetes worker node!|`KUBERNETES_INGRESSES_ATTACHTONODES`|`false`|
|`kubernetes.services.ClusterIP.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_TYPE_DISCOVER`|`false`|
|`kubernetes.services.ClusterIP.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`ICINGA_SERVICES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.ClusterIP.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`ICINGA_SERVICES_CLUSTERIP_HOST_DEFINITION`|`{}`|
|`kubernetes.services.ClusterIP.serviceTemplates`|Specify a list of icinga service templates|`ICINGA_SERVICES_CLUSTERIP_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.ClusterIP.hostTemplates`|Specify a list of host templates|`ICINGA_SERVICES_CLUSTERIP_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.ClusterIP.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_CLUSTERIP_APPLYSERVICES`|`true`|
|`kubernetes.services.NodePort.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_TYPE_DISCOVER`|`true`|
|`kubernetes.services.NodePort.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`ICINGA_SERVICES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.NodePort.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`ICINGA_SERVICES_NODEPORT_HOST_DEFINITION`|`{}`|
|`kubernetes.services.NodePort.serviceTemplates`|Specify a list of icinga service templates|`ICINGA_SERVICES_NODEPORT_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.NodePort.hostTemplates`|Specify a list of host templates|`ICINGA_SERVICES_NODEPORT_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.NodePort.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_NODEPORT_APPLYSERVICES`|`true`|
|`kubernetes.services.LoadBalancer.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_TYPE_DISCOVER`|`true`|
|`kubernetes.services.LoadBalancer.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`ICINGA_SERVICES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.LoadBalancer.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`ICINGA_SERVICES_LOADBALANCER_HOST_DEFINITION`|`{}`|
|`kubernetes.services.LoadBalancer.serviceTemplates`|Specify a list of icinga service templates|`ICINGA_SERVICES_LOADBALANCER_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.LoadBalancer.hostTemplates`|Specify a list of host templates|`ICINGA_SERVICES_LOADBALANCER_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.LoadBalancer.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_LOADBALANCER_APPLYSERVICES`|`true`|
