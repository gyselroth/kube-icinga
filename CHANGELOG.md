## 2.1.0
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Tue Mar 19 2019 16:01:20 CET 2019

* [FEATURE] Change servicegroup definition #17


## 2.0.1
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Thu Feb 21 17:14:20 CET 2019

* [FIX] none string environment variables not parsed correctly into config #10


## 2.0.0
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Thu Feb 21 14:28:20 PM CET 2019

* [FIX] Fixes "(node:25116) UnhandledPromiseRejectionWarning: TypeError: result is not iterable" due error response from icinga
* [FIX] Better error handling and catching various uncaught promises
* [FIX] Docs fix regaring how to create icinga2 api user
* [CHANGE] Upgrade to winston ^3.0.0 stable
* [CHANGE] Log format is now in json and includes a timestamp
* [FIX] Service protocol is now lower cases which fixes issues like check_command=TCP insteadof check_command=tcp
* [FIX] Fixes icinga api username is now correctly read from ICINGA_API_USERNAME as documented (instead ICINGA_API_USER)
* [FEATURE] Add support for service/host definitions in kubernetes annotations #1
* [BREAKER!] Removed service.portNameAsCommand option, use kubernetes annotations
* [FEATURE] Discover persistent volumes and create icinga services for those #4
* [FIX] Fixed typo Definiton => Definition in default config example
* [CHANGE] Added various new tests
* [FIX] kube workes are in no namespace, remove icinga groups
* [FIX] fixed Error: Invalid attribute specified: host_name\n for kube nodes
* [FIX] fixed duplicate ingress objects (different path, same ingress names in different namespaces, ...)
* [CHANGE] Added hostName setting, by default all resources (except nodes) get attached to single host object of their type (can be configured differently)
* [CHANGE] Implemented workaround for icinga issue https://github.com/Icinga/icinga2/issues/6012, restart icinga service after adding new objects
* [FIX] Changing boolean values in config.json now reflects as configured (Set to false was not possible in v1.x)


## 1.0.1
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Fri Jun 01 01:18:20 CEST 2018

* [FIX] fixed protocol (service ports.protocol) lowercase
* [CHANGE] config logger.level => log.level
* [FIX] catch error objects from kube watchers


## 1.0.0
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Thu May 24 14:52:11 CEST 2018

Initial release
