import Service from '../../src/kube/service'; 
import Node from '../../src/kube/node'; 
import Icinga from '../../src/icinga';
import Logger from '../../src/logger'; 
jest.mock('../../src/icinga');
jest.mock('../../src/kube/node');
jest.mock('../../src/logger');

const template = {
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

var fixture;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));
});

describe('kubernetes services', () => {
  describe('service watch stream', () => {
    it('do not create icinga service object if typ is disabled for provisioning', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          discover: false
        }
      });

      var resource = {  
        type: 'ADDED', 
        object: fixture
      };
      
      Icinga.deleteServicesByFilter = jest.fn();
      Icinga.applyHost = jest.fn();
      
      var bindings = {};
      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(Icinga.applyHost.mock.calls.length).toBe(0);  
      expect(Icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });
    
    it('create icinga service object', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          discover: true
        }
      });
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };
      
      Icinga.deleteServicesByFilter = jest.fn();
      Icinga.applyHost = jest.fn();
      
      var bindings = {};
      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(Icinga.applyHost.mock.calls.length).toBe(1);  
      expect(Icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });
    
    it('modify service object delete and create', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          discover: true
        }
      });

      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      Icinga.applyHost = jest.fn();
      Icinga.deleteServicesByFilter = function(definition) {
        expect(definition).toEqual('service.vars.kubernetes.metadata.uid==\"xyz\"');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

      var bindings = {};
      var json = {
        on: async function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(Icinga.applyHost.mock.calls.length).toBe(1);  
    });
    
    it('delete service object delete', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          discover: true
        }
      });

      var resource = {  
        type: 'DELETED', 
        object: fixture
      };

      Icinga.applyHost = jest.fn();
      Icinga.deleteServicesByFilter = function(definition) {
        expect(definition).toEqual('service.vars.kubernetes.metadata.uid==\"xyz\"');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };


      var bindings = {};
      var json = {
        on: function(name, callback) {
          bindings[name] = callback.bind(instance);
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(Icinga.applyHost.mock.calls.length).toBe(0);  
    });
  });

  describe('add service object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: false
        }
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-clusterip-services');
      expect(call[1].address).toBe('kubernetes-clusterip-services');
      expect(call[1].display_name).toBe('kubernetes-clusterip-services');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create dynamic icinga host object', () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          hostName: null,
          applyServices: false
        }
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('service-foobar-foo');
      expect(call[1].address).toBe('10.99.24.32');
      expect(call[1].display_name).toBe('service-foobar-foo');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create icinga host object with custom definitions', () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: false,
          hostDefinition: {
            'vars.foo': 'bar',
            'vars.check_command': 'foo'
          }
        }
      });
      
      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[1]['vars.foo']).toBe('bar');
      expect(call[1]['vars.check_command']).toBe('foo');
    });
    
    it('create icinga host object with templates', () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: false,
          hostTemplates: ['foo', 'bar']
        }      
      });

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });
    
    it('do not create icinga host object while service is of type NodePort', () => {
      let instance = new Service(Logger, Node, Icinga, {
        NodePort: {
          applyServices: false
        }
      });

      fixture.spec.type = 'NodePort';
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      expect(Icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add service object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Service(Logger, Node, Icinga);

      Icinga.applyHost = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      await instance.prepareObject(fixture);  
      const call = Icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Service(Logger, Node, Icinga, {
        applyServices: false
      });

      instance.prepareObject(fixture);  
      Icinga.applyServiceGroup = jest.fn();
      const call = Icinga.applyServiceGroup.mock.instances[0];
      expect(Icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });

  describe('add all service object ports as service objects', () => {
    it('create all service objects', async () => {
      let instance = new Service(Logger, Node, Icinga);

      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('kubernetes-clusterip-services');
      expect(calls[1][0]).toBe('kubernetes-clusterip-services');
      expect(calls[0][1]).toBe('foobar-foo-http');
      expect(calls[1][1]).toBe('foobar-foo-bar');

      expect(calls[0][2]['check_command']).toBe('tcp');
      expect(calls[0][2]['vars.tcp_port']).toBe(80);
      expect(calls[1][2]['check_command']).toBe('tcp');
      expect(calls[1][2]['vars.tcp_port']).toBe(10000);
    });
    
    it('create all service objects with dynamic hosts', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          hostName: null 
        }
      });

      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][0]).toBe('service-foobar-foo');
      expect(calls[1][0]).toBe('service-foobar-foo');
    });

    it('create all service objects with custom service definition', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            'check_command': 'http',
            'vars.foo': 'bar'
          }
        } 
      });

      Icinga.applyHost = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('http');
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('http');
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with custom service definition, check_command not found, fallback to protocol', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            'check_command': 'http',
            'vars.foo': 'bar'
          }
        } 
      });

      Icinga.applyHost = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.hasCheckCommand.mockResolvedValue(false);

      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
      expect(calls[1][2].check_command).toBe('tcp');
      expect(calls[1][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with templates', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true,
          serviceTemplates: ['foo', 'bar']
        }    
      });

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
      expect(calls[1][3]).toEqual(['foo', 'bar']);
    });
  });

  describe('kubernetes annotations', () => {
    it('check_command/templates annotation', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true
        }  
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';
      Icinga.applyService = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.hasCheckCommand.mockResolvedValue(true);
      Icinga.applyHost = jest.fn();
      Icinga.applyServiceGroup = jest.fn();

      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
      expect(calls[1][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            check_command: 'foo'
          }
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[1][2].check_command).toBe('bar');
    });

    it('definiton merge', async () => {
      let instance = new Service(Logger, Node, Icinga, {
        ClusterIP: {
          applyServices: true,
          serviceDefinition: {
            check_command: 'foo'
          }
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.hasCheckCommand = jest.fn();
      Icinga.hasCheckCommand.mockResolvedValue(true);

      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(2);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
