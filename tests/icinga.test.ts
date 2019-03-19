import * as IcingaApi from 'icinga2-api';
import IcingaClient from '../src/icinga';
import Logger from '../src/logger';
jest.mock('icinga2-api');
jest.mock('../src/logger');
var icinga;

beforeEach(() => {
  icinga = new IcingaClient(Logger, IcingaApi);
});

describe('icinga', () => {
  describe('check_command', () => {
    it('icinga check_command does not exists', async () => {
      IcingaApi.getCheckCommand = jest.fn()
        .mockImplementation((command, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.hasCheckCommand('foobar')).resolves.toEqual(false); 
      const calls = IcingaApi.getCheckCommand.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
    });
    
    it('icinga check_command does exists', async () => {
      IcingaApi.getCheckCommand = jest.fn()
        .mockImplementation((command, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.hasCheckCommand('foobar')).resolves.toEqual(true); 
      const calls = IcingaApi.getCheckCommand.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
    });
    
    it('icinga check_command error response', async () => {
      IcingaApi.getCheckCommand = jest.fn()
        .mockImplementation((command, cb) => cb({Statuscode: 500}, null));

      var result = await expect(icinga.hasCheckCommand('foobar')).rejects.toEqual({
        Statuscode: 500
      }); 

      const calls = IcingaApi.getCheckCommand.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
  });

  describe('apply host group', () => {
    it('icinga host group does exists', async () => {
      IcingaApi.createHostGroup = jest.fn();
      IcingaApi.getHostGroup = jest.fn()
        .mockImplementation((hostgroup, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.applyHostGroup('foobar')).resolves.toEqual(true); 
      const calls = IcingaApi.getHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createHostGroup.mock.calls.length).toBe(0);
    });

    it('get host group error response', async () => {
      IcingaApi.createHostGroup = jest.fn();
      IcingaApi.getHostGroup = jest.fn()
        .mockImplementation((hostgroup, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.applyHostGroup('foobar')).rejects.toEqual({
        Statuscode: 500
      }); 
      const calls = IcingaApi.getHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createHostGroup.mock.calls.length).toBe(0);
    });
    
    it('add new host group', async () => {
      IcingaApi.createHostGroup = jest.fn()
        .mockImplementation((hostgroup, display_name, data, cb) => cb(null, {foo: "bar"}));

      IcingaApi.getHostGroup = jest.fn()
        .mockImplementation((hostgroup, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyHostGroup('foobar')).resolves.toEqual(true);
      var calls = IcingaApi.getHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
    });
    
    it('add new host group error response', async () => {
      IcingaApi.createHostGroup = jest.fn()
        .mockImplementation((hostgroup, display_name, data, cb) => cb({Statuscode: 500}, null));

      IcingaApi.getHostGroup = jest.fn()
        .mockImplementation((hostgroup, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyHostGroup('foobar')).resolves.toEqual(false);

      var calls = IcingaApi.getHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createHostGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
    });
  });

  describe('apply service group', () => {
    it('icinga service group does exists', async () => {
      IcingaApi.createServiceGroupCustom = jest.fn();
      IcingaApi.getServiceGroup = jest.fn()
        .mockImplementation((ServiceGroup, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.applyServiceGroup('foobar', {zone: "foo"})).resolves.toEqual(true); 
      const calls = IcingaApi.getServiceGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createServiceGroupCustom.mock.calls.length).toBe(0);
    });

    it('get service group error response', async () => {
      IcingaApi.createServiceGroup = jest.fn();
      IcingaApi.getServiceGroup = jest.fn()
        .mockImplementation((ServiceGroup, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.applyServiceGroup('foobar')).rejects.toEqual({
        Statuscode: 500
      }); 
      const calls = IcingaApi.getServiceGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createServiceGroupCustom.mock.calls.length).toBe(0);
    });
    
    it('add new service group', async () => {
      IcingaApi.createServiceGroupCustom = jest.fn()
        .mockImplementation((ServiceGroup, name, cb) => cb(null, {foo: "bar"}));

      IcingaApi.getServiceGroup = jest.fn()
        .mockImplementation((ServiceGroup, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyServiceGroup('foobar', {zone: "foo"})).resolves.toEqual(true);
      var calls = IcingaApi.getServiceGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createServiceGroupCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('foobar');
      expect(calls[0][0]).toBe("{\"attrs\":{\"zone\":\"foo\"}}");
    });
    
    it('add new service group error response', async () => {
      IcingaApi.createServiceGroupCustom = jest.fn()
        .mockImplementation((ServiceGroup, name, cb) => cb({Statuscode: 500}, null));

      IcingaApi.getServiceGroup = jest.fn()
        .mockImplementation((ServiceGroup, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyServiceGroup('foobar', {zone: "foo"})).resolves.toEqual(false);

      var calls = IcingaApi.getServiceGroup.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createServiceGroupCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('foobar');
    });
  });

  describe('apply host', () => {
    it('icinga host does exists', async () => {
      IcingaApi.createHostCustom = jest.fn();
      IcingaApi.getHostState = jest.fn()
        .mockImplementation((Host, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.applyHost('foobar')).resolves.toEqual(true); 
      const calls = IcingaApi.getHostState.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createHostCustom.mock.calls.length).toBe(0);
    });

    it('get host error response', async () => {
      IcingaApi.createHostCustom = jest.fn();
      IcingaApi.getHostState = jest.fn()
        .mockImplementation((Host, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.applyHost('foobar')).rejects.toEqual({
        Statuscode: 500
      }); 
      const calls = IcingaApi.getHostState.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createHostCustom.mock.calls.length).toBe(0);
    });
    
    it('add new host', async () => {
      IcingaApi.createHostCustom = jest.fn()
        .mockImplementation((data, name, cb) => cb(null, {foo: "bar"}));

      IcingaApi.getHostState = jest.fn()
        .mockImplementation((Host, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyHost('foobar', {foo: "bar"}, ["foobar"])).resolves.toEqual(true);
      var calls = IcingaApi.getHostState.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createHostCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe(JSON.stringify({
        attrs: {
          foo: "bar"
        },
        templates: ["foobar"]
      }));

      expect(calls[0][1]).toBe('foobar');
    });
    
    it('add new host error response', async () => {
      IcingaApi.createHostCustom = jest.fn()
        .mockImplementation((data, name, cb) => cb({Statuscode: 500}, null));

      IcingaApi.getHostState = jest.fn()
        .mockImplementation((Host, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyHost('foobar')).resolves.toEqual(false);

      var calls = IcingaApi.getHostState.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createHostCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('foobar');
    });

    it('add new host restarts icinga service', async () => {
      IcingaApi.restartProcess = jest.fn()
        .mockImplementation((cb) => cb(null, {foo: "bar"}));

      jest.useFakeTimers();
      icinga = new IcingaClient(Logger, IcingaApi);

      IcingaApi.createHostCustom = jest.fn()
        .mockImplementation((data, name, cb) => cb(null, {foo: "bar"}));

      IcingaApi.getHostState = jest.fn()
        .mockImplementation((Host, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyHost('foobar', {foo: "bar"}, ["foobar"])).resolves.toEqual(true);

      var calls = IcingaApi.getHostState.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createHostCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe(JSON.stringify({
        attrs: {
          foo: "bar"
        },
        templates: ["foobar"]
      }));

      expect(calls[0][1]).toBe('foobar');
      jest.runOnlyPendingTimers();
      expect(IcingaApi.restartProcess.mock.calls.length).toBe(1);
    });
  });
  
  describe('apply service', () => {
    it('icinga service does exists', async () => {
      IcingaApi.createServiceCustom = jest.fn();
      IcingaApi.getService = jest.fn()
        .mockImplementation((host, service, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.applyService('foobar')).resolves.toEqual(true); 
      const calls = IcingaApi.getService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createServiceCustom.mock.calls.length).toBe(0);
    });

    it('get service error response', async () => {
      IcingaApi.createServiceCustom = jest.fn();
      IcingaApi.getService = jest.fn()
        .mockImplementation((host, service, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.applyService('foobar')).rejects.toEqual({
        Statuscode: 500
      }); 
      const calls = IcingaApi.getService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(IcingaApi.createServiceCustom.mock.calls.length).toBe(0);
    });
    
    it('add new service', async () => {
      IcingaApi.createServiceCustom = jest.fn()
        .mockImplementation((data, host, name, cb) => cb(null, {foo: "bar"}));

      IcingaApi.getService = jest.fn()
        .mockImplementation((host, service, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyService('foobar', 'bar', {foo: "bar"}, ["foobar"])).resolves.toEqual(true);
      var calls = IcingaApi.getService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      
      calls = IcingaApi.createServiceCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe(JSON.stringify({
        attrs: {
          foo: "bar"
        },
        templates: ["foobar"]
      }));

      expect(calls[0][1]).toBe('foobar');
      expect(calls[0][2]).toBe('bar');
    });
    
    it('add new service error response', async () => {
      IcingaApi.createServiceCustom = jest.fn()
        .mockImplementation((data, host, name, cb) => cb({Statuscode: 500}, null));

      IcingaApi.getService = jest.fn()
        .mockImplementation((host, service, cb) => cb({Statuscode: 404}, null));

      await expect(icinga.applyService('foobar', 'bar')).resolves.toEqual(false);

      var calls = IcingaApi.getService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('foobar');
      expect(calls[0][1]).toBe('bar');
      
      calls = IcingaApi.createServiceCustom.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('foobar');
      expect(calls[0][2]).toBe('bar');
    });
  });

  describe('delete service', () => {
    it('delete service successfully', async () => {
      IcingaApi.deleteService = jest.fn()
        .mockImplementation((host, service, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.deleteService('foo', 'bar')).resolves.toEqual(true); 
      const calls = IcingaApi.deleteService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('bar');
      expect(calls[0][1]).toBe('foo');
    });

    it('delete service failed', async () => {
      IcingaApi.deleteService = jest.fn()
        .mockImplementation((host, service, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.deleteService('foo', 'bar')).resolves.toEqual(false); 
      const calls = IcingaApi.deleteService.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('bar');
      expect(calls[0][1]).toBe('foo');
    });
  });

  describe('delete host', () => {
    it('delete host successfully', async () => {
      IcingaApi.deleteHost = jest.fn()
        .mockImplementation((host, cb) => cb(null, {foo: "bar"}));

      await expect(icinga.deleteHost('bar')).resolves.toEqual(true); 
      const calls = IcingaApi.deleteHost.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('bar');
    });

    it('delete host failed', async () => {
      IcingaApi.deleteHost = jest.fn()
        .mockImplementation((host, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.deleteHost('bar')).resolves.toEqual(false); 
      const calls = IcingaApi.deleteHost.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('bar');
    });
  });


  describe('delete services by filter', () => {
    it('delete service filtered', async () => {
      icinga.deleteService = jest.fn();
      IcingaApi.getServiceFiltered = jest.fn()
        .mockImplementation((host, cb) => cb(null, [
          {attrs: {name: "foo", host_name: "foo"}},
          {attrs: {name: "bar", host_name: "bar"}},
      ]));

      await expect(icinga.deleteServicesByFilter('vars.bar==true')).resolves.toEqual(true); 
      expect(icinga.deleteService.mock.calls.length).toBe(2);
    });

    it('get services filtered failed', async () => {
      IcingaApi.deleteService = jest.fn();
      IcingaApi.getServiceFiltered = jest.fn()
        .mockImplementation((host, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.deleteServicesByFilter('vars.bar==true')).rejects.toEqual({Statuscode: 500}); 
      expect(IcingaApi.deleteService.mock.calls.length).toBe(0);
    });
  });

  describe('delete hosts by filter', () => {
    it('delete host filtered', async () => {
      icinga.deleteHost = jest.fn();
      IcingaApi.getHostFiltered = jest.fn()
        .mockImplementation((host, cb) => cb(null, [
          {attrs: {name: "foo"}},
          {attrs: {name: "bar"}},
      ]));

      await expect(icinga.deleteHostsByFilter('vars.bar==true')).resolves.toEqual(true); 
      expect(icinga.deleteHost.mock.calls.length).toBe(2);
    });

    it('get hosts filtered failed', async () => {
      IcingaApi.deleteHost = jest.fn();
      IcingaApi.getHostFiltered = jest.fn()
        .mockImplementation((host, cb) => cb({Statuscode: 500}, null));

      await expect(icinga.deleteHostsByFilter('vars.bar==true')).rejects.toEqual({Statuscode: 500}); 
      expect(IcingaApi.deleteHost.mock.calls.length).toBe(0);
    });
  });
});
