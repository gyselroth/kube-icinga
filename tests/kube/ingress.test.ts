import Ingress from '../../src/kube/ingress'; 
import Node from '../../src/kube/node'; 
import Icinga from '../../src/icinga';
import {LoggerInstance} from 'winston'; 
import JSONStream from 'json-stream';
const KubeApi = require('kubernetes-client').Client;
jest.mock('../../src/icinga');
jest.mock('../../src/kube/node');
jest.mock('json-stream');
jest.mock(KubeApi.Client);

const fixture = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Ingress",
    "metadata": {
        "annotations": {},
        "creationTimestamp": "2018-02-06T15:30:59Z",
        "generation": 4,
        "name": "foo",
        "namespace": "foobar",
        "resourceVersion": "21173149",
        "selfLink": "/apis/extensions/v1beta1/namespaces/foobar/ingresses/foo",
        "uid": "bba7f53c-0b52-11e8-a755-0050568fe3c2"
    },
    "spec": {
        "rules": [
            {
                "host": "foobar.example.org",
                "http": {
                    "paths": [
                        {
                            "backend": {
                                "serviceName": "foo-backend",
                                "servicePort": 80
                            }
                        }
                    ]
                }
            },
            {
                "host": "barfoo.example.org",
                "http": {
                    "paths": [
                        {
                            "path": "/foo",
                            "backend": {
                                "serviceName": "foo-backend",
                                "servicePort": 80
                            }
                        }
                    ]
                }
            }
        ]
    },
    "status": {
        "loadBalancer": {}
    }
};
const tlsFixture = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Ingress",
    "metadata": {
        "annotations": {},
        "creationTimestamp": "2018-02-06T15:30:59Z",
        "generation": 4,
        "name": "foo",
        "namespace": "foobar",
        "resourceVersion": "21173149",
        "selfLink": "/apis/extensions/v1beta1/namespaces/foobar/ingresses/foo",
        "uid": "bba7f53c-0b52-11e8-a755-0050568fe3c2"
    },
    "spec": {
        "rules": [
            {
                "host": "barfoo.example.org",
                "http": {
                    "paths": [
                        {
                            "backend": {
                                "serviceName": "foo-backend",
                                "servicePort": 80
                            }
                        }
                    ]
                }
            }
        ]
        "tls": {
          "secretName": "foo"
        }
    },
};

describe('kubernetes ingresses', () => {
  var instance: Ingress;

  describe('add ingress object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga);
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('foo');
      expect(call[1]).toBe('foo');
      expect(call[2].display_name).toBe('foo');
      expect(call[2].check_command).toBe('dummy');
    });

    it('create icinga host object with custom definitions', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        hostDefinition: {
          'vars.foo': 'bar',
          'vars.check_command': 'foo'
        }
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[2]['vars.foo']).toBe('bar');
      expect(call[2]['vars.check_command']).toBe('foo');
    });

    it('create icinga host object with templates', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        hostTemplates: ['foo', 'bar']
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[3]).toEqual(['foo', 'bar']);
    });

    it('do not create icinga host object while attachToNodes is enabled', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        attachToNodes: true
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      expect(Icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add ingress object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream);

      Icinga.applyHost = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      await instance.prepareObject(fixture);  
      const call = Icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: false
      });

      Icinga.applyServiceGroup = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyServiceGroup.mock.instances[0];
      expect(Icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });

  describe('add all ingress object http path rules as service objects', () => {
    it('create all service objects', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream);

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('foo');
      expect(calls[1][0]).toBe('foo');
      expect(calls[0][1]).toBe('foobar.example.org:http');
      expect(calls[1][1]).toBe('barfoo.example.org:http');
      expect(calls[0][2]['vars.http_path']).toBe('/');
      expect(calls[1][2]['vars.http_path']).toBe('/foo');
    });

    it('create all service objects with custom service definition', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true,
        serviceDefinition: {
          'check_command': 'tcp',
          'vars.foo': 'bar'
        } 
      });

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('tcp');
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with templates', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
      expect(calls[1][3]).toEqual(['foo', 'bar']);
    });

    it('create service objects for tls enabled ingresses', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      Icinga.applyService = jest.fn();
      await instance.prepareObject(tlsFixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][1]).toBe('barfoo.example.org:http');
      expect(calls[1][1]).toBe('barfoo.example.org:https');
      expect(calls[1][2]['vars.http_ssl']).toBe(true);
    });
  });
});
