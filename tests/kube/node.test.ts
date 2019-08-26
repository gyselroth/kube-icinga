import Node from '../../src/kube/node'; 
import Logger from '../../src/logger'; 

jest.mock('../../src/logger');
var Icinga = (jest.genMockFromModule('../../src/icinga') as any).default;
import * as JSONStream from 'json-stream';
const Readable = require('stream').Readable;

const template = {
    "apiVersion": "v1",
    "kind": "Node",
    "metadata": {
        "annotations": {},
        "name": "kubernetes-worker001.foo.bar",
    },
    "spec": {
        "externalID": "kubernetes-worker001.foo.bar"
    }
};

var fixture;
var logger;
var node;
var icinga;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));

  logger = Logger;
  
  Icinga.mockClear();
  icinga = new Icinga();
});

describe('kubernetes nodes', () => {
  describe('nodes watch stream', () => {
    var bindings; 
    beforeEach(() => {
      bindings= {data:function(){}};
    });

    it('create icinga host object', async () => {
      let instance = new Node(logger, icinga);
      var resource = {  
        type: 'ADDED', 
        object: fixture
      };
      
      instance.prepareObject = function(definition) {
        expect(definition).toEqual(resource.object);
        return new Promise((resolve,reject) => {
          resolve(true);
        });
      };

      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      bindings.data(resource);
    });
    
    /*it('modify host object no action', async () => {
      let instance = new Node(logger, icinga);
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      instance.prepareObject = jest.fn();

      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      var result = await bindings.data(resource);
      expect(result).toBe(false);
      expect(instance.prepareObject.mock.calls.length).toBe(0);  
    });
    
    it('delete host object delete', async () => {
      let instance = new Node(logger, icinga);
      var resource = {  
        type: 'DELETED', 
        object: fixture
      };

      instance.prepareObject = jest.fn();
      
      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      await bindings.data(resource);
      expect(icinga.deleteHost.mock.calls.length).toEqual(1)
      expect(instance.prepareObject.mock.calls.length).toEqual(0);  
    });*/

    it('skip resource with invalid kind', async () => {
      let instance = new Node(logger, icinga)

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
      let instance = new Node(logger, icinga);

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

  describe('add node object', () => {
    it('create icinga host object', () => {
      let instance = new Node(logger, icinga, JSONStream);
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].display_name).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].check_command).toBe('ping');
      expect(instance.getWorkerNodes()).toEqual(['kubernetes-worker001.foo.bar']);
    });
    
    it('create icinga host object (kubernetes worker unschedulable)', () => {
      let instance = new Node(logger, icinga, JSONStream);
      fixture.spec.unschedulable = true;
      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].display_name).toBe('kubernetes-worker001.foo.bar');
      expect(instance.getWorkerNodes()).toEqual([]);
    });
     
    it('create icinga host object with custom definitions', () => {
      let instance = new Node(logger, icinga, {
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
      let instance = new Node(logger, icinga, {
        hostTemplates: ['foo', 'bar']
      });

      instance.prepareObject(fixture);  
      const call = icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });
  });
});

