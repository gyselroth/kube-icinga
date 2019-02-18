import Node from '../../src/kube/node'; 
import Icinga from '../../src/icinga';
import Logger from '../../src/logger'; 
import * as JSONStream from 'json-stream';
jest.mock('../../src/icinga');
jest.mock('../../src/logger');
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

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(template));
});

describe('kubernetes nodes', () => {
  describe('nodes watch stream', () => {
    it('create icinga host object', async () => {
      let instance = new Node(Logger, Icinga);
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

      var bindings = {};
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
    
    it('modify host object no action', async () => {
      let instance = new Node(Logger, Icinga);
      var resource = {  
        type: 'MODIFIED', 
        object: fixture
      };
      
      instance.prepareObject = jest.fn();

      var bindings = {};
      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      bindings.data(resource);
      expect(instance.prepareObject.mock.calls.length).toBe(0);  
    });
    
    it('delete host object delete', async () => {
      let instance = new Node(Logger, Icinga);
      var resource = {  
        type: 'DELETED', 
        object: fixture
      };

      Icinga.deleteHost = jest.fn();
      instance.prepareObject = jest.fn();

      var bindings = {};
      var json = {
        on: function(name, callback) {
          bindings[name] = callback;
        }
      };
    
      await instance.kubeListener(() => {
        return json;
      });

      bindings.data(resource);
      expect(Icinga.deleteHost.mock.calls.length).toEqual(1)
      expect(instance.prepareObject.mock.calls.length).toEqual(0);  
    });
  });

  describe('add node object', () => {
    it('create icinga host object', () => {
      let instance = new Node(Logger, Icinga, JSONStream);
      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].display_name).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].check_command).toBe('ping');
      expect(instance.getWorkerNodes()).toEqual(['kubernetes-worker001.foo.bar']);
    });
    
    it('create icinga host object (kubernetes worker unschedulable)', () => {
      let instance = new Node(Logger, Icinga, JSONStream);
      Icinga.applyHost = jest.fn();
      fixture.spec.unschedulable = true;
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[0]).toBe('kubernetes-worker001.foo.bar');
      expect(call[1].display_name).toBe('kubernetes-worker001.foo.bar');
      expect(instance.getWorkerNodes()).toEqual([]);
    });
     
    it('create icinga host object with custom definitions', () => {
      let instance = new Node(Logger, Icinga, {
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
      let instance = new Node(Logger, Icinga, {
        hostTemplates: ['foo', 'bar']
      });

      Icinga.applyHost = jest.fn();
      instance.prepareObject(fixture);  
      const call = Icinga.applyHost.mock.calls[0];
      expect(call[2]).toEqual(['foo', 'bar']);
    });
  });
});

