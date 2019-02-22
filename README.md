# kube-icinga
[![Build Status](https://travis-ci.org/gyselroth/kube-icinga.svg)](https://travis-ci.org/gyselroth/kube-icinga)
[![Coverage Status](https://coveralls.io/repos/github/gyselroth/kube-icinga/badge.svg?branch=master)](https://coveralls.io/github/gyselroth/kube-icinga?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/gyselroth/kube-icinga.svg)](https://github.com/gyselroth/kube-icinga/releases)

kube-icinga automatically deploys icinga objects out of your kubernetes resources.
It has built-in autodiscovery and will work out of the box. However you can change various default configurations and deploy 
custom icinga objects or disable/enable kubernetes objects to monitor.

## Features

* Autodiscovery
* Icinga servicegroup support
* Create services for kubernetes nodes, services, ingresses and persistent volumes
* Completely customizable per resource or per resource type

## How does it work?

Multiple watchers are bootstraped and listen for any kubernetes changes. Those changes will reflect immediately on your icinga environment.

* Kubernetes namespaces will result in icinga service groups
* Nodes will result in host objects 
* Ingresses will result in icinga services (and or host objects)
* Services (ClusterIP, NodePort, LoadBalanacer) will result in icinga services (and/or host objects)
* Persistent volumes will result in icinga services (and/or host objects)

## Table of Contents
* [Features](#features)
* [How does it work?](#how-does-it-work)
* [Resource types](#resource-types)
  * [Namespaces](#namespaces)
  * [Nodes](#nodes)
  * [Ingresses](#ingresses)
  * [Services](#services)
  * [Volumes](#volumes)
* [Requirements](#requirements)
* [Setup icinga2 api user](#setup-icinga2-api-user)
* [Deployment](#deployment)
* [Resource visibility](#resource-visibility)
* [Advanced topics](#advanced-topics)
  * [Using icinga2 apply rules](#using-icinga2-apply-rules)
  * [Globally overwrite icinga object definitions](#globally-overwrite-icinga-object-definitions)
  * [Overwrite icinga object definitions directly in kubernetes resources](overwrite-icinga-object-definitions-directly-in-kubernetes-resources)
* [Configuration](#configuration)

## Resource types

### Namespaces
Namespaces will result in icinga servicegroups.
Note that the servicegroup gets only created if one of the following resources exist in a given namespace.

### Nodes
Kubernetes nodes get mappend 1:1 to icinga host objects. There is no other magic.
However you may change the icinga host object by configuring the global config `kubernetes.nodes` or 
change annotations values in single node objects.

### Ingresses
Each kubernetes ingress hostname/path will result in a single icinga service. By default all those services get 
attached to a single icinga host named `kubernetes-ingresses` and each service also gets attached to a servicegroup which is taken from the kubernetes namespace.
You may change the hostname by configuring `kubernetes.ingresses.hostName` (or set a custom hostname in an annotation) or even set `kubernetes.ingresses.hostName` to `null`.
If hostName is `null`, host objects get dynamically created named `ingress-${namespace}-${name}`. This will result in more host objects but the services still get created and get attached to their servicegroup (namespace).
If you choose to create dynamic host objects you may want to disable service provisioning, you may set `kubernetes.ingresses.applyServices` to `false` and create services manually with icinga apply rules (see [advanced](#using-icinga2-apply-rules)).
Besides that you can still configure advanced options for those host objects and/or service objects (See configuration).
For instance you may attach ingress services directly to all kubernetes worker nodes by setting `kubernetes.ingresses.attachToNodes` to `true`. (This will result in many more services and checks depending on the size of your cluster!)

By default ingresses get checked with the `http` check_command. Usually you do not want to change this but you can by using annotations or changing the global ingress settings.

### Services
Each service port will result in a single icinga service (like ingress paths). By default all those services get 
attached to a single host named `kubernetes-${serviceType}-services`. Supported service types are either ClusterIP, NodePort or LoadBalancer.
Like ingresses you may change the hostname or configure host provisioning by setting hostName to `false` (`kubernetes.services.${serviceType}.hostName`).
Dynamic service host objects get named `service-${namespace}-${name}`. You may also disable service provisioning by setting `kubernetes.services.${serviceType}.applyServices` to `false` if you prefer icinga apply rules.
ClusterIP provisioning is disabled by default since ClusterIP services are only visible internally in kubernetes. You need either an icinga deployment within the kubernetes cluster or optionally 
an icinga [satelite](https://www.icinga.com/docs/icinga2/latest/doc/06-distributed-monitoring) if you decide to enable ClusterIP provisioning.
NodePort services get attached by default directly to the kubernetes icinga node objects.

By default services get checked with the service protocol which usually result in check_tcp. However you may set custom settings using annotations (or global service settings). 

### Volumes
Each persistent volume will result in a single icinga service. By default all those services get attached to a single host named `kubernetes-volumes`.
Like for ingresses and services you may change the same advanced settings for volumes. 
Since a persistent volume is not directly attached to namespace the namespace for the service group gets taken from the persistent volume claim.

>**Note** Volume services are created by default with the dummy check_command. Since there is no way for kube-icinga to specify the correct command automatically. You need to either overwrite the check_command in annotations, set the command
in the serviceDefinition for volumes or disable service provisioning, enable host provisioning (set hostName to `null`) and create icinga apply rule based services manually.

You may wonder where your pods are in this setup. Well it does not make any sense to monitor single pods. Pods are mortal and (always) moving. The important thing is to monitor your services as an entity.


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

>**Note**: kube-icinga will be created as single pod deployment in the kubernetes kube-system namespace. You may changes this behaviour.

### Resource visibility
The resource yaml also contains a new cluster role `kube-icinga`. kube-icinga will create icinga objects for all visible namespaces which are by default all namespaces since it is a kubernetes cluster role.
You may specify resources visibile to kube-icinga with custom RBAC rules.

## Advanced topics

### Using icinga2 apply rules
You certainly can use icinga2 apply rules. You may disable auto service deployments via `applyServices` for ingresses, services and volumes and define your own services via [apply rules](https://www.icinga.com/docs/icinga2/latest/doc/03-monitoring-basics/#using-apply).
Of course you can also setup a mixed deployment. Automatically let kube-icinga deploy services and apply additional services via apply rules. 

>**Note**: Since icinga apply rules are [not triggered](https://www.icinga.com/docs/icinga2/latest/doc/12-icinga2-api/#modifying-objects) if an object gets updated kube-icinga will delete and recreate those objects. 

All icinga host objects are created with all kubernetes data available packed in the variable `vars.kubernetes`. Therefore you may apply rules with this data.

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

>**Note**: With annotations you may set specific settings for each kubernetes resources while configure options for kube-icinga set settings on a resource type basis.

You may use the following annotations:

| Name | Description |
|-------|------------|
| `kube-icinga/check_command` | Use a custom icinga check command. |
| `kube-icinga/host` | Use a custom hostname (to which icinga host a service gets bound to). |
| `kube-icinga/template` | Use a custom icinga template. |
| `kube-icinga/definition` | JSON encoded icinga definiton which may contain advanced icinga options and gets merged with the defaults. |


```yaml
kind: PersistentVolume
apiVersion: v1
metadata:
  name: generic-storage-24afe01f-2300-11e9-94e3-0050568fe3c2,
  selfLink":"/api/v1/persistentvolumes/generic-storage-24afe01f-2300-11e9-94e3-0050568fe3c2
  uid":"2a66425e-2300-11e9-94e3-0050568fe3c2
  resourceVersion: 65603642
  creationTimestamp: 2019-01-28T13:25:22Z
  annotations:
    kube-icinga/check_command: "check_storage_lun"
    kube-icinga/hostname: "storagesystem.example.lan"
    hpe.com/docker-volume-name": "generic-storage-24afe01f-2300-11e9-94e3-0050568fe3c2"
    pv.kubernetes.io/provisioned-by: "example.com/storage"
    volume.beta.kubernetes.io/storage-class: "generic-storage"
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
|`kubernetes.nodes.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_NODES_HOST_DEFINITION`|`{}`|
|`kubernetes.nodes.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_NODES_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.ingresses.discover`|Deploy kubernetes ingress objects|`KUBERNETES_INGRESSES_DISCOVER`|`true`|
|`kubernetes.ingresses.hostName`|The name of the icinga host object to attach services to (May also be null to enabled host object provisioning)|`KUBERNETES_INGRESSES_HOSTNAME`|`kubernetes-ingresses`|
|`kubernetes.ingresses.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`KUBERNETES_INGRESSES_SERVICE_DEFINITION`|'{}'|
|`kubernetes.ingresses.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_INGRESSES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.ingresses.serviceTemplates`|Specify a list of icinga service templates (comma separated string if defined via env variable)|`KUBERNETES_INGRESSES_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.ingresses.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_INGRESSES_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.ingresses.applyServices`|Apply ingress paths as icinga services attached to the icinga ingress host|`KUBERNETES_INGRESSES_APPLYSERVICES`|`true`|
|`kubernetes.ingresses.attachToNodes`|If `true` instead attaching port services to a dummy host object `metadata.name` all services get attached to each kubernetes worker node!|`KUBERNETES_INGRESSES_ATTACHTONODES`|`false`|
|`kubernetes.volumes.discover`|Deploy kubernetes ingress objects|`KUBERNETES_VOLUMES_DISCOVER`|`true`|
|`kubernetes.volumes.hostName`|The name of the icinga host object to attach services to (May also be null to enabled host object provisioning)|`KUBERNETES_VOLUMES_HOSTNAME`|`kubernetes-volumes`|
|`kubernetes.volumes.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`KUBERNETES_VOLUMES_SERVICE_DEFINITION`|'{}'|
|`kubernetes.volumes.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_VOLUMES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.volumes.serviceTemplates`|Specify a list of icinga service templates (comma separated string if defined via env variable)|`KUBERNETES_VOLUMES_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.volumes.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_VOLUMES_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.volumes.applyServices`|Apply volumes as icinga services attached to a icinga host object|`KUBERNETES_VOLUMES_APPLYSERVICES`|`true`|
|`kubernetes.volumes.attachToNodes`|If `true` instead attaching port services to a dummy host object `metadata.name` all services get attached to each kubernetes worker node!|`KUBERNETES_VOLUMES_ATTACHTONODES`|`false`|
|`kubernetes.services.ClusterIP.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_CLUSTERIP_DISCOVER`|`false`|
|`kubernetes.services.ClusterIP.hostName`|The name of the icinga host object to attach services to (May also be null to enabled host object provisioning)|`KUBERNETES_SERVICES_CLUSTERIP_HOSTNAME`|`kubernetes-clusterip-services`|
|`kubernetes.services.ClusterIP.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`KUBERNETES_SERVICES_CLUSTERIP_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.ClusterIP.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_SERVICES_CLUSTERIP_HOST_DEFINITION`|`{}`|
|`kubernetes.services.ClusterIP.serviceTemplates`|Specify a list of icinga service templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_CLUSTERIP_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.ClusterIP.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_CLUSTERIP_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.ClusterIP.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_CLUSTERIP_APPLYSERVICES`|`true`|
|`kubernetes.services.NodePort.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_NODEPORT_DISCOVER`|`true`|
|`kubernetes.services.NodePort.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`KUBERNETES_SERVICES_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.NodePort.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_SERVICES_NODEPORT_HOST_DEFINITION`|`{}`|
|`kubernetes.services.NodePort.serviceTemplates`|Specify a list of icinga service templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_NODEPORT_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.NodePort.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_NODEPORT_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.NodePort.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_NODEPORT_APPLYSERVICES`|`true`|
|`kubernetes.services.NodePort.hostName`|The name of the icinga host object to attach services to (May also be null to enabled host object provisioning)|`KUBERNETES_SERVICES_NODEPORT_HOSTNAME`|`kubernetes-nodeport-services`|
|`kubernetes.services.LoadBalancer.discover`|Deploy kubernetes service objects|`KUBERNETES_SERVICES_LOADBALANCER_DISCOVER`|`true`|
|`kubernetes.services.LoadBalancer.hostName`|The name of the icinga host object to attach services to (May also be null to enabled host object provisioning)|`KUBERNETES_SERVICES_LOADBALANCER_HOSTNAME`|`kubernetes-loadbalancer-services`|
|`kubernetes.services.LoadBalancer.serviceDefinition`|You may overwrite specific attributes of the icinga [service definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#service). |`KUBERNETES_SERVICES_LOADBALANCER_SERVICE_DEFINITION`|`{}`|
|`kubernetes.services.LoadBalancer.hostDefinition`|You may overwrite specific attributes of the icinga [host definiton](https://www.icinga.com/docs/icinga2/latest/doc/09-object-types/#host).|`KUBERNETES_SERVICES_LOADBALANCER_HOST_DEFINITION`|`{}`|
|`kubernetes.services.LoadBalancer.serviceTemplates`|Specify a list of icinga service templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_LOADBALANCER_SERVICE_TEMPLATES`|`['generic-service']`|
|`kubernetes.services.LoadBalancer.hostTemplates`|Specify a list of host templates (comma separated string if defined via env variable)|`KUBERNETES_SERVICES_LOADBALANCER_HOST_TEMPLATES`|`['generic-host']`|
|`kubernetes.services.LoadBalancer.applyServices`|URI of LDAP server|`KUBERNETES_SERVICES_LOADBALANCER_APPLYSERVICES`|`true`|
