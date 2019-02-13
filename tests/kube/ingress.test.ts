import Ingress from '../../src/kube/ingress'; 
import Node from '../../src/kube/node'; 
import Icinga from '../../src/icinga';
import {LoggerInstance} from 'winston'; 
import * as JSONStream from 'json-stream';
const KubeApi = require('kubernetes-client').Client;
jest.mock('../../src/icinga');
jest.mock('../../src/kube/node');
jest.mock('json-stream');
jest.mock('kubernetes-client');

const template = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Ingress",
    "metadata": {
        "annotations": {},
        "name": "foo",
        "namespace": "foobar",
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

var fixture;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));
});

describe('kubernetes ingresses', () => {
  var instance: Ingress;

  describe('add ingress object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga);
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('foo');
      expect(call[1].display_name).toBe('foo');
      expect(call[1].check_command).toBe('dummy');
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
      expect(call[1]['vars.foo']).toBe('bar');
      expect(call[1]['vars.check_command']).toBe('foo');
    });

    it('create icinga host object with templates', () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        hostTemplates: ['foo', 'bar']
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
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

      fixture.spec.tls = {
        secretName: 'foo'
      }

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(4);
      expect(calls[0][1]).toBe('foobar.example.org:http');
      expect(calls[1][1]).toBe('foobar.example.org:https');
      expect(calls[1][2]['vars.http_ssl']).toBe(true);
    });

  });

  describe('kubernetes annotations', () => {
    it('check_command/templates annotation', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
      expect(calls[1][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
    });

    it('definiton merge', async () => {
      let instance = new Ingress(LoggerInstance, Node, KubeApi, Icinga, JSONStream, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
