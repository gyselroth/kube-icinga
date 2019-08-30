import Service from '../../src/kube/service'; 
import Logger from '../../src/logger'; 
import {default as RealNode} from '../../src/kube/node';
import {Logger as LoggerInterface} from 'winston';

jest.mock('../../src/logger');
var Node = (jest.genMockFromModule('../../src/kube/node') as any).default;
var Icinga = (jest.genMockFromModule('../../src/icinga') as any).Icinga;

const template: any = {
    "apiVersion": "v1",
    "kind": "Service",
    "metadata": {
        "name": "foo",
        "namespace": "foobar",
        "annotations": {},
        "uid": "xyz"
    },
    "spec": {
        "clusterIP": "10.99.24.32",
        "ports": [
            {
                "name": "http",
                "port": 80,
                "protocol": "TCP",
                "targetPort": 80
            },
            {
                "name": "bar",
                "port": 10000,
                "protocol": "tcp",
                "targetPort": 10000
            }
        ],
        "selector": {
            "app": "bar"
        },
        "sessionAffinity": "None",
        "type": "ClusterIP"
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

  Node.mockClear();
  node = new Node();

  logger = Logger;

  Icinga.mockClear();
  icinga = new Icinga();
});

describe('kubernetes services', () => {
  describe('service watch stream', () => {
    var bindings: any;
    beforeEach(() => {
      bindings= {data:function(){}};
    });

    it('do not create icinga service object if typ is disabled for provisioning', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: false
        }
      });

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
      expect(icinga.applyHost.mock.calls.length).toBe(0);  
      expect(icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });
    
    it('create icinga service object', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });
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
    
    it('modify service object delete and create', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });

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
    
    it('delete service object delete', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });

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

    it('skip headless service', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });

      fixture.spec.clusterIP = 'None';
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

    it('skip resource with invalid kind', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });

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
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          discover: true
        }
      });

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

    it('ignore unknown service in object preparation', async () => {
      let instance = new Service(logger, node, icinga);
      
      fixture.spec.type = 'foobar';
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

  describe('add service object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: false
        }
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-clusterip-services');
      expect(call[1].address).toBe('10.99.24.32');
      expect(call[1].display_name).toBe('kubernetes-clusterip-services');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create dynamic icinga host object', () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          hostName: null,
          applyServices: false
        }
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('service-foobar-foo');
      expect(call[1].address).toBe('10.99.24.32');
      expect(call[1].display_name).toBe('service-foobar-foo');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create icinga host object with custom definitions', () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: false,
          hostDefinition: {
            'vars.foo': 'bar',
            'vars.check_command': 'foo'
          }
        }
      });
      
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[1]['vars.foo']).toBe('bar');
      expect(call[1]['vars.check_command']).toBe('foo');
    });
    
    it('create icinga host object with templates', () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: false,
          hostTemplates: ['foo', 'bar']
        }      
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });
    
    it('do not create icinga host object while service is of type NodePort', () => {
      let instance = new Service(logger, node, icinga, {
        NodePort: {
          applyServices: false
        }
      });

      fixture.spec.type = 'NodePort';
      instance.prepareObject(fixture);  
      expect(icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add service object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Service(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const call = icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Service(logger, node, icinga, {
        NodePort: {
          applyServices: false
        }
      });

      instance.prepareObject(fixture);  
      expect(icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });

  describe('add all service object ports as service objects', () => {
    it('create all service objects', async () => {
      let instance = new Service(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('kubernetes-clusterip-services');
      expect(calls[1][0]).toBe('kubernetes-clusterip-services');
      expect(calls[0][1]).toBe('foobar-foo-http');
      expect(calls[1][1]).toBe('foobar-foo-bar');

      expect(calls[0][2]['check_command']).toBe('tcp');
      expect(calls[0][2]['vars.tcp_address']).toBe('10.99.24.32');
      expect(calls[0][2]['vars.tcp_port']).toBe(80);
      expect(calls[1][2]['check_command']).toBe('tcp');
      expect(calls[1][2]['vars.tcp_address']).toBe('10.99.24.32');
      expect(calls[1][2]['vars.tcp_port']).toBe(10000);
    });
    
    it('create all service objects with dynamic hosts', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          hostName: null 
        }
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('service-foobar-foo');
      expect(calls[1][0]).toBe('service-foobar-foo');
    });

    it('create all service objects with custom service definition', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            'check_command': 'http',
            'vars.foo': 'bar'
          }
        } 
      });

      icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('http');
      expect(calls[0][2]['vars.http_address']).toBe('10.99.24.32');
      expect(calls[0][2]['vars.http_port']).toBe(80);
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('http');
      expect(calls[1][2]['vars.http_address']).toBe('10.99.24.32');
      expect(calls[1][2]['vars.http_port']).toBe(10000);
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });
    
    it('use dummy check for udp protocol', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
        } 
      });

      fixture.spec.ports[1].protocol = 'UDP';
      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[1][2].check_command).toBe('dummy');
    });
    
    it('use custom check plugin for for udp protocol', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            'check_command': 'dns',
          }
        } 
      });

      icinga.hasCheckCommand.mockResolvedValue(true);
      fixture.spec.ports[1].protocol = 'UDP';
      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[1][2].check_command).toBe('dns');
      expect(calls[1][2]['vars.dns_port']).toBe(10000);
    });

    it('create all service objects with custom service definition, check_command not found, fallback to protocol', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            'check_command': 'http',
            'vars.foo': 'bar'
          }
        } 
      });

      icinga.hasCheckCommand.mockResolvedValue(false);

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('tcp');
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with templates', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceTemplates: ['foo', 'bar']
        }    
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
      expect(calls[1][3]).toEqual(['foo', 'bar']);
    });
    
    it('create NodePort service objects', async () => {
      let instance = new Service(logger, node, icinga);

      node.getWorkerNodes = function() {
        return ['foo', 'bar'];
      };

      fixture.spec.type = 'NodePort'

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyHost.mock.instances.length).toBe(0);
      expect(icinga.applyService.mock.instances.length).toBe(4);

      expect(calls[0][0]).toBe('foo');
      expect(calls[1][0]).toBe('bar');
      expect(calls[0][1]).toBe('foobar-foo-http');
      expect(calls[1][1]).toBe('foobar-foo-http');
      expect(calls[0][2]['check_command']).toBe('tcp');
      expect(calls[0][2]['vars.tcp_address']).toBe(undefined);
      expect(calls[0][2]['vars.tcp_port']).toBe(80);
      expect(calls[1][2]['check_command']).toBe('tcp');
      expect(calls[1][2]['vars.tcp_address']).toBe(undefined);
      expect(calls[1][2]['vars.tcp_port']).toBe(80);

      expect(calls[2][0]).toBe('foo');
      expect(calls[3][0]).toBe('bar');
      expect(calls[2][1]).toBe('foobar-foo-bar');
      expect(calls[3][1]).toBe('foobar-foo-bar');
      expect(calls[2][2]['check_command']).toBe('tcp');
      expect(calls[2][2]['vars.tcp_address']).toBe(undefined);
      expect(calls[2][2]['vars.tcp_port']).toBe(10000);
      expect(calls[3][2]['check_command']).toBe('tcp');
      expect(calls[3][2]['vars.tcp_address']).toBe(undefined);
      expect(calls[3][2]['vars.tcp_port']).toBe(10000);
    });

    it('create LoadBalancer service objects with loadBalancerIP', async () => {
      let instance = new Service(logger, node, icinga);
      fixture.spec.type = 'LoadBalancer';
      fixture.spec.loadBalancerIP = '10.10.10.10';
      fixture.spec.ports[0].nodePort = 100;
      fixture.spec.ports[1].nodePort = 100;

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);

      expect(calls[0][2]['check_command']).toBe('tcp');
      expect(calls[0][2]['vars.tcp_address']).toBe('10.10.10.10');
      expect(calls[0][2]['vars.tcp_port']).toBe(80);
      expect(calls[1][2]['check_command']).toBe('tcp');
      expect(calls[1][2]['vars.tcp_address']).toBe('10.10.10.10');
      expect(calls[1][2]['vars.tcp_port']).toBe(10000);
    });
    
    it('create LoadBalancer service objects', async () => {
      let instance = new Service(logger, node, icinga);
      fixture.spec.type = 'LoadBalancer';
      fixture.spec.ports[0].nodePort = 100;
      fixture.spec.ports[1].nodePort = 100;

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);

      expect(calls[0][2]['check_command']).toBe('tcp');
      expect(calls[0][2]['vars.tcp_address']).toBe('10.99.24.32');
      expect(calls[0][2]['vars.tcp_port']).toBe(80);
      expect(calls[1][2]['check_command']).toBe('tcp');
      expect(calls[1][2]['vars.tcp_address']).toBe('10.99.24.32');
      expect(calls[1][2]['vars.tcp_port']).toBe(10000);
    });
    
    it('skip unknown service type', async () => {
      let instance = new Service(logger, node, icinga);
      fixture.spec.type = 'foobar';
      expect(instance.prepareObject(fixture)).rejects.toThrow('unknown service type provided');  
    });
     
    it('skip empty metadata name', async () => {
      let instance = new Service(logger, node, icinga);
      delete fixture.metadata.name;
      expect(instance.prepareObject(fixture)).rejects.toThrow('resource name/namespace in metadata is required');  
    });  
    
    it('skip empty metadata namespace', async () => {
      let instance = new Service(logger, node, icinga);
      delete fixture.metadata.namespace;
      expect(instance.prepareObject(fixture)).rejects.toThrow('resource name/namespace in metadata is required');  
    });  
  });

  describe('kubernetes annotations', () => {
    it('custom icinga host annotation', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true
        }  
      });

      fixture.metadata.annotations['kube-icinga/host'] = 'foobar';
      icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      expect(icinga.applyHost.mock.instances.length).toBe(1);
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('foobar');
      expect(call[1].address).toBe('10.99.24.32');
      
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2]['host_name']).toBe('foobar');
      expect(calls[1][2]['host_name']).toBe('foobar');
    });
    
    it('check_command/templates annotation', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true
        }  
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';
      icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
      expect(calls[0][2]['vars.bar_address']).toBe('10.99.24.32');
      expect(calls[0][2]['vars.bar_port']).toBe(80);
      expect(calls[1][2]['vars.bar_address']).toBe('10.99.24.32');
      expect(calls[1][2]['vars.bar_port']).toBe(10000);
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
      expect(calls[1][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            check_command: 'foo'
          }
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
    });

    it('definiton merge', async () => {
      let instance = new Service(logger, node, icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            check_command: 'foo'
          }
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
