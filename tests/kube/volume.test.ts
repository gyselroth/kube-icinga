import Volume from '../../src/kube/volume'; 
import Node from '../../src/kube/node'; 
import Icinga from '../../src/icinga';
import Logger from '../../src/logger'; 
jest.mock('../../src/logger');
jest.mock('../../src/icinga');
jest.mock('kubernetes-client');

const template = {
    "apiVersion": "v1",
    "kind": "PersistentVolume",
    "metadata": {
        "annotations": {
            "hpe.com/docker-volume-name": "generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2",
            "pv.kubernetes.io/provisioned-by": "hpe.com/nimble",
            "volume.beta.kubernetes.io/storage-class": "generic-nimble"
        },
        "name": "generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2",
        "uid": "xyz"  
    },
    "spec": {
        "accessModes": [
            "ReadWriteOnce"
        ],
        "capacity": {
            "storage": "50Gi"
        },
        "claimRef": {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "name": "nimbletestpvc-006",
            "namespace": "foobar"
        },
        "flexVolume": {
            "driver": "hpe.com/nimble",
            "options": {
                "name": "generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2",
                "thick": "false"
            }
        },
        "persistentVolumeReclaimPolicy": "Delete",
        "storageClassName": "generic-nimble"
    },
    "status": {
        "phase": "Bound"
    }
};

var fixture;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));
});

describe('kubernetes volumes', () => {
  describe('volume watch stream', () => {
    it('create icinga volume object', async () => {
      let instance = new Volume(Logger, Node, Icinga);
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

      var result = await bindings.data(resource);
      expect(result).toBe(true);  
      expect(Icinga.applyHost.mock.calls.length).toBe(1);  
      expect(Icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });
    
    it('modify volume object delete and create', async () => {
      let instance = new Volume(Logger, Node, Icinga);
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

      var result = await bindings.data(resource);
      expect(result).toBe(true);  
      expect(Icinga.applyHost.mock.calls.length).toBe(1);  
    });

    it('modify ingress object delete and create host', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        hostName: null
      });
        
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      Icinga.applyHost = jest.fn();
      Icinga.deleteServicesByFilter = jest.fn();
      Icinga.deleteHost = function(name) {
        expect(name).toEqual('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
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

      var result = await bindings.data(resource);
      expect(result).toBe(true);  
      expect(Icinga.applyHost.mock.calls.length).toBe(1);  
      expect(Icinga.deleteServicesByFilter.mock.calls.length).toBe(0);  
    });

    it('skip resource with invalid kind', async () => {
      let instance = new Volume(Logger, Node, Icinga);

      fixture.kind = 'foo';
      var resource = {  
        type: 'ADDED', 
        object: fixture
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

      var result = await bindings.data(resource);
      expect(result).toBe(false);  
    });
    
    it('skip resource kube-icinga/discover===false', async () => {
      let instance = new Volume(Logger, Node, Icinga);

      fixture.metadata.annotations['kube-icinga/discover'] = 'false';
      var resource = {  
        type: 'ADDED', 
        object: fixture
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

      var result = await bindings.data(resource);
      expect(result).toBe(false);  
      });
    });
  });

  describe('add volume object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false
      });
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-volumes');
      expect(call[1].display_name).toBe('kubernetes-volumes');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create icinga host object with dynamic host', () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false,
        hostName: null
      });
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(call[1].display_name).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(call[1].check_command).toBe('dummy');
    });

    it('create icinga host object with custom definitions', () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false,
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
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false,
        hostTemplates: ['foo', 'bar']
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });

    it('do not create icinga host object while attachToNodes is enabled', () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false,
        attachToNodes: true
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      expect(Icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add volume object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Volume(Logger, Node, Icinga);

      Icinga.applyHost = jest.fn();
      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      await instance.prepareObject(fixture);  
      const call = Icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: false
      });

      Icinga.applyServiceGroup = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyServiceGroup.mock.instances[0];
      expect(Icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });

  describe('add all volume objects as service objects', () => {
    it('create service object', async () => {
      let instance = new Volume(Logger, Node, Icinga);

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][0]).toBe('kubernetes-volumes');
      expect(calls[0][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    });
    
    it('create service object with dynamic host', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        hostName: null
      });

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][0]).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    }

    it('create all service objects with custom service definition', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: true,
        serviceDefinition: {
          'check_command': 'tcp',
          'vars.foo': 'bar'
        } 
      });

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with templates', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
    });

    it('attach services to kube workers if attachToNodes is enabled', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        attachToNodes: true
      });

      Node.getWorkerNodes = function() {
        return ['foo', 'bar'];
      };

      Icinga.applyService = jest.fn();
      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyHost = jest.fn();

      await instance.prepareObject(fixture);  
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyHost.mock.instances.length).toBe(0);
      expect(Icinga.applyService.mock.instances.length).toBe(2);

      expect(calls[0][0]).toBe('foo');
      expect(calls[1][0]).toBe('bar');
      expect(calls[0][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(calls[1][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    });     
  });

  describe('kubernetes annotations', () => {
    it('check_command/templates annotation', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: true
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('bar');
    });

    it('definiton merge', async () => {
      let instance = new Volume(Logger, Node, Icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      Icinga.applyServiceGroup = jest.fn();
      Icinga.applyService = jest.fn();
      await instance.prepareObject(fixture);
      const calls = Icinga.applyService.mock.calls;
      expect(Icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
