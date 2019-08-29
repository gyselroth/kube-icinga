import Ingress from '../../src/kube/ingress'; 
import {default as RealNode} from '../../src/kube/node'; 
import Logger from '../../src/logger'; 
import {Logger as LoggerInterface} from 'winston';

jest.mock('../../src/logger');
var Node = (jest.genMockFromModule('../../src/kube/node') as any).default;
var Icinga = (jest.genMockFromModule('../../src/icinga') as any).Icinga;

const template: any = {
    "apiVersion": "extensions/v1beta1",
    "kind": "Ingress",
    "metadata": {
        "annotations": {},
        "name": "foo",
        "namespace": "foobar",
        "uid": "xyz"
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

var fixture: any;
var logger: LoggerInterface;
var node: RealNode;
var icinga: any;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));

  jest.resetAllMocks();
  Node.mockClear();
  node = new Node();
  
  logger = Logger;
  
  Icinga.mockReset();
  icinga = new Icinga();
});

describe('kubernetes ingresses', () => {
  describe('ingress watch stream', () => {
    var bindings: any; 
    beforeEach(() => {
      bindings= {data:function(){}};
    });

    it('create icinga ingress object', async () => {
      let instance = new Ingress(logger, node, icinga);
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };
      
      var json: any = {
        on: function(name: string, callback: any) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
      expect(icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });

    it('modify ingress object delete and create', async () => {
      let instance = new Ingress(logger, node, icinga);
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      icinga.deleteServicesByFilter = function(definition: any) {
        expect(definition).toEqual('service.vars.kubernetes.metadata.uid==\"xyz\"');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

      var json: any = {
        on: async function(name: string, callback: any) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
    });

    it('modify ingress object delete and create host', async () => {
      let instance = new Ingress(logger, node, icinga, {
        hostName: null
      });
        
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      icinga.deleteHost = function(name: string) {
        expect(name).toEqual('ingress-foobar-foo');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

      var json: any = {
        on: async function(name: string, callback: any) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
      expect(icinga.deleteServicesByFilter.mock.calls.length).toBe(0);  
    });
    
    it('delete ingress object delete', async () => {
      let instance = new Ingress(logger, node, icinga);

      var resource = {  
        type: 'DELETED', 
        object: fixture
      };

      icinga.deleteServicesByFilter = function(definition: any) {
        expect(definition).toEqual('service.vars.kubernetes.metadata.uid==\"xyz\"');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

      var json: any = {
        on: function(name: string, callback: any) {
          bindings[name] = callback.bind(instance);
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(icinga.applyHost.mock.calls.length).toBe(0);  
    });

    it('skip resource with invalid kind', async () => {
      let instance = new Ingress(logger, node, icinga);

      fixture.kind = 'foo';
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };

      var json: any = {
        on: function(name: string, callback: any) {
          bindings[name] = callback.bind(instance);
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      var result = await bindings.data(resource);
      expect(result).toBe(false);  
    });
    
    it('skip resource kube-icinga/discover===false', async () => {
      let instance = new Ingress(logger, node, icinga);

      fixture.metadata.annotations['kube-icinga/discover'] = 'false';
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };

      var json: any = {
        on: function(name: string, callback: any) {
          bindings[name] = callback.bind(instance);
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      var result = await bindings.data(resource);
      expect(result).toBe(false);  
    });      
  });
  
  describe('add ingress object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false
      });
      
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-ingresses');
      expect(call[1].display_name).toBe('kubernetes-ingresses');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create icinga host object with dynamic host', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false,
        hostName: null
      });
      
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('ingress-foobar-foo');
      expect(call[1].display_name).toBe('ingress-foobar-foo');
      expect(call[1].check_command).toBe('dummy');
    });

    it('create icinga host object with custom definitions', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false,
        hostDefinition: {
          'vars.foo': 'bar',
          'vars.check_command': 'foo'
        }
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[1]['vars.foo']).toBe('bar');
      expect(call[1]['vars.check_command']).toBe('foo');
    });

    it('create icinga host object with templates', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false,
        hostTemplates: ['foo', 'bar']
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });

    it('do not create icinga host object while attachTonodes is enabled', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false,
        attachToNodes: true
      });

      instance.prepareObject(fixture);  
      expect(icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add ingress object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Ingress(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const call = icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: false
      });

      instance.prepareObject(fixture);  
      expect(icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });
  
  describe('add all ingress object http path rules as service objects', () => {
    it('create all service objects', async () => {
      let instance = new Ingress(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('kubernetes-ingresses');
      expect(calls[1][0]).toBe('kubernetes-ingresses');
      expect(calls[0][1]).toBe('foobar.example.org-http--');
      expect(calls[1][1]).toBe('barfoo.example.org-http--foo');
      expect(calls[0][2]['vars.http_path']).toBe('/');
      expect(calls[1][2]['vars.http_path']).toBe('/foo');
    });
    
    it('create all service objects with dynamic hosts', async () => {
      var icinga = new Icinga();
      let instance = new Ingress(logger, node, icinga, {
        hostName: null
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('ingress-foobar-foo');
      expect(calls[1][0]).toBe('ingress-foobar-foo');
    });
    
    it('create all service objects with custom service definition', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          'check_command': 'tcp',
          'vars.foo': 'bar'
        } 
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('tcp');
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });
    
    it('create all service objects with templates', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
      expect(calls[1][3]).toEqual(['foo', 'bar']);
    });
    
    it('create service objects for tls enabled ingresses', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      fixture.spec.tls = {
        secretName: 'foo'
      }

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(4);
      expect(calls[0][1]).toBe('foobar.example.org-http--');
      expect(calls[1][1]).toBe('foobar.example.org-https--');
      expect(calls[1][2]['vars.http_ssl']).toBe(true);
    });
    
    it('attach services to kube workers if attachToNodes is enabled', async () => {
      let instance = new Ingress(logger, node, icinga, {
        attachToNodes: true
      });

      node.getWorkerNodes = function() {
        return ['foo', 'bar'];
      };


      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyHost.mock.instances.length).toBe(0);
      expect(icinga.applyService.mock.instances.length).toBe(4);

      expect(calls[0][0]).toBe('foo');
      expect(calls[1][0]).toBe('bar');
      expect(calls[2][0]).toBe('foo');
      expect(calls[3][0]).toBe('bar');
      expect(calls[0][1]).toBe('foobar.example.org-http--');
      expect(calls[1][1]).toBe('foobar.example.org-http--');
      expect(calls[2][1]).toBe('barfoo.example.org-http--foo');
      expect(calls[3][1]).toBe('barfoo.example.org-http--foo');
    });  
  });

  describe('kubernetes annotations', () => {
    it('check_command/templates annotation', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';
      
      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
      expect(calls[1][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
    });
  
    it('definiton merge', async () => {
      let instance = new Ingress(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
