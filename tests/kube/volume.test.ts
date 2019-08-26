import Volume from '../../src/kube/volume'; 
import Logger from '../../src/logger'; 
jest.mock('../../src/logger');
jest.mock('../../src/icinga');

jest.mock('../../src/logger');
var Node = (jest.genMockFromModule('../../src/kube/node') as any).default;
var Icinga = (jest.genMockFromModule('../../src/icinga') as any).default;

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
var logger;
var node;
var icinga;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));

  Node.mockClear();
  node = new Node();

  logger = Logger;

  Icinga.mockClear();
  icinga = new Icinga();
});

describe('kubernetes volumes', () => {
  describe('volume watch stream', () => {
    var bindings; 
    beforeEach(() => {
      bindings= {data:function(){}};
    });

    it('create icinga volume object', async () => {
      let instance = new Volume(logger, node, icinga);
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };
      
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
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
      expect(icinga.deleteServicesByFilter.mock.calls.length).toBe(0);
    });
    
    it('modify volume object delete and create', async () => {
      let instance = new Volume(logger, node, icinga);
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      icinga.deleteServicesByFilter = function(definition) {
        expect(definition).toEqual('service.vars.kubernetes.metadata.uid==\"xyz\"');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

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
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
    });

    it('modify ingress object delete and create host', async () => {
      let instance = new Volume(logger, node, icinga, {
        hostName: null
      });
        
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      icinga.deleteHost = function(name) {
        expect(name).toEqual('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

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
      expect(icinga.applyHost.mock.calls.length).toBe(1);  
      expect(icinga.deleteServicesByFilter.mock.calls.length).toBe(0);  
    });

    it('skip resource with invalid kind', async () => {
      let instance = new Volume(logger, node, icinga);

      fixture.kind = 'foo';
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };

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
      let instance = new Volume(logger, node, icinga);

      fixture.metadata.annotations['kube-icinga/discover'] = 'false';
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };

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

  describe('add volume object with dummy host', () => {
    it('create icinga host object', () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: false
      });
      
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-volumes');
      expect(call[1].display_name).toBe('kubernetes-volumes');
      expect(call[1].check_command).toBe('dummy');
    });
    
    it('create icinga host object with dynamic host', () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: false,
        hostName: null
      });
      
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(call[1].display_name).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(call[1].check_command).toBe('dummy');
    });

    it('create icinga host object with custom definitions', () => {
      let instance = new Volume(logger, node, icinga, {
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
      let instance = new Volume(logger, node, icinga, {
        applyServices: false,
        hostTemplates: ['foo', 'bar']
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });

    it('do not create icinga host object while attachToNodes is enabled', () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: false,
        attachToNodes: true
      });

      instance.prepareObject(fixture);  
      expect(icinga.applyHost.mock.instances.length).toBe(0);
    });
  });
  
  describe('add volume object namespace as service group', () => {
    it('create service group per default', async () => {
      let instance = new Volume(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const call = icinga.applyServiceGroup.mock.calls[0];
      expect(call[0]).toBe('foobar');
    });
    
    it('do not create servicegroup if applyServices is disabled', () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: false
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyServiceGroup.mock.instances[0];
      expect(icinga.applyServiceGroup.mock.instances.length).toBe(0);
    });
  });

  describe('add all volume objects as service objects', () => {
    it('create service object', async () => {
      let instance = new Volume(logger, node, icinga);

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][0]).toBe('kubernetes-volumes');
      expect(calls[0][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    });
    
    it('create service object with dynamic host', async () => {
      let instance = new Volume(logger, node, icinga, {
        hostName: null
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][0]).toBe('volume-generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    });

    it('create all service objects with custom service definition', async () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          'check_command': 'tcp',
          'vars.foo': 'bar'
        } 
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('tcp');
      expect(calls[0][2]['vars.foo']).toBe('bar');
    });

    it('create all service objects with templates', async () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: true,
        serviceTemplates: ['foo', 'bar']
      });

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][3]).toEqual(['foo', 'bar']);
    });

    it('attach services to kube workers if attachToNodes is enabled', async () => {
      let instance = new Volume(logger, node, icinga, {
        attachToNodes: true
      });

      node.getWorkerNodes = function() {
        return ['foo', 'bar'];
      };

      await instance.prepareObject(fixture);  
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyHost.mock.instances.length).toBe(0);
      expect(icinga.applyService.mock.instances.length).toBe(2);

      expect(calls[0][0]).toBe('foo');
      expect(calls[1][0]).toBe('bar');
      expect(calls[0][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
      expect(calls[1][1]).toBe('generic-nimble-fad5684e-22fb-11e9-94e3-0050568fe3c2');
    });     
  });

  describe('kubernetes annotations', () => {
    it('check_command/templates annotation', async () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: true
      });

      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';
      fixture.metadata.annotations['kube-icinga/templates'] = 'foobar,barfoo';

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('bar');
      expect(calls[0][3]).toEqual(['foobar', 'barfoo']);
    });
    
    it('use annotation instead global definition', async () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/check_command'] = 'bar';

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2].check_command).toBe('bar');
    });

    it('definiton merge', async () => {
      let instance = new Volume(logger, node, icinga, {
        applyServices: true,
        serviceDefinition: {
          check_command: 'foo'
        }
      });
      fixture.metadata.annotations['kube-icinga/definition'] = '{"vars.foo": "foobar"}';

      await instance.prepareObject(fixture);
      const calls = icinga.applyService.mock.calls;
      expect(icinga.applyService.mock.instances.length).toBe(1);
      expect(calls[0][2]["check_command"]).toBe('foo');
      expect(calls[0][2]["vars.foo"]).toBe('foobar');
    });
  });
});
