import {Logger} from 'winston';
import IcingaClient from 'icinga2-api';

/**
 * icinga wrapper
 */
export default class Icinga {
  protected logger: Logger;
  protected icingaClient: IcingaClient;
  protected triggerRestart: boolean=false;

  /**
   * icinga wrapper
   */
  constructor(logger: Logger, icingaClient: IcingaClient) {
    this.logger = logger;
    this.icingaClient = icingaClient;
    this.checkRestart();
  }

  /**
   * Check if restarted needed
   */
  protected checkRestart(): void {
    setInterval(() => {
      this.logger.debug('check if icinga service restart is required (https://github.com/Icinga/icinga2/issues/6012)');
      if (this.triggerRestart === true) {
        this.logger.debug('icinga service restart required');
        this.triggerRestart = false;

        this.icingaClient.restartProcess((err, result) => {
          if (err) {
            this.logger.error('trigger icinga service restart', {error: err});
          } else {
            this.logger.info('icinga service restart triggered');
          }
        });
      }
    }, 30000);
  }

  /**
   * Check if check command is available
   */
  public hasCheckCommand(command: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.icingaClient.getCheckCommand(command, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            resolve(false);
          } else {
            reject(err);
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create host group
   */
  public applyHostGroup(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`apply host group ${name} aka kubernetes namespace`);

      this.icingaClient.getHostGroup(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostGroup(name, name, [], (err, result) => {
              if (err) {
                this.logger.error(`failed create host group ${name}`, {error: err});
                resolve(false);
              } else {
                this.logger.info(`host group ${name} was created successfully`, {result: result});
                this.triggerRestart = true;
                resolve(true);
              }
            });
          } else {
            reject(err);
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create service group
   */
  public applyServiceGroup(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`apply service group ${name} aka kubernetes namespace`);

      this.icingaClient.getServiceGroup(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`service group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createServiceGroup(name, name, [], (err, result) => {
              if (err) {
                this.logger.error(`failed create service group ${name}`, {error: err});
                resolve(false);
              } else {
                this.logger.info(`service group ${name} was created successfully`, {result: result});
                this.triggerRestart = true;
                resolve(true);
              }
            });
          } else {
            reject(err);
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create or update a new icinga host object
   */
  public applyHost(name: string, definition, templates: string[]=[]): Promise<boolean> {
    let host = {
      attrs: definition,
      templates: templates,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply new host ${name}`, {host: host});

      this.icingaClient.getHostState(name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostCustom(JSON.stringify(host), name, (err, result) => {
              if (err) {
                this.logger.error(`failed create host ${name}`, {error: err});
                resolve(false);
              } else {
                this.logger.info(`host ${name} was created successfully`, {result: result});
                this.triggerRestart = true;
                resolve(true);
              }
            });
          } else {
            reject(err);
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Create or update an icinga service object
   */
  public applyService(host: string, name: string, definition, templates: string[]=[]): Promise<boolean> {
    let service = {
      attrs: definition,
      templates: templates,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply service ${name} to host ${host}`, {service: definition});

      this.icingaClient.getService(host, name, (err, result) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`service ${name} on host ${host} was not found, create one`, {error: err});

            this.icingaClient.createServiceCustom(JSON.stringify(service), host, name, (err, result) => {
              if (err) {
                this.logger.error(`failed create service ${name} on host ${host}`, {error: err});
                resolve(false);
              } else {
                this.logger.info(`service ${name} on host ${host} was created successfully`, {result: result});
                this.triggerRestart = true;
                resolve(true);
              }
            });
          } else {
            reject(err);
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Delete icinga service object
   */
  public deleteService(host: string, name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`delete service ${name} from host ${host}`);

      return this.icingaClient.deleteService(name, host, (err, result) => {
        if (err) {
          this.logger.error(`failed delete service ${name} from host ${host}`, {error: err});
          resolve(false);
        } else {
          this.logger.info(`service ${name} was deleted successfully from host ${host}`, {result: result});
          resolve(true);
        }
      });
    });
  }

  /**
   * Delete icinga host object
   */
  public deleteHost(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.logger.info(`delete host ${name}`);

      this.icingaClient.deleteHost(name, (err, result) => {
        if (err) {
          this.logger.error(`failed delete host ${name}`, {error: err});
          resolve(false);
        } else {
          this.logger.info(`host ${name} was deleted successfully`, {result: result});
          resolve(true);
        }
      });
    });
  }

  /**
   * Delete services by filter
   */
  public async deleteServicesByFilter(filter: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.icingaClient.getServiceFiltered({filter: filter}, async (err, result) => {
        if (err) {
          return reject(err);
        }

        let handlers = [];
        for (const service of result) {
          handlers.push(this.deleteService(service.attrs.host_name, service.attrs.name));
        }

        await Promise.all(handlers);
        resolve(true);
      });
    });
  }

  /**
   * Delete hosts by filter
   */
  public async deleteHostsByFilter(filter: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.icingaClient.getHostFiltered({filter: filter}, async (err, result) => {
        if (err) {
          return reject(err);
        }

        let handlers = [];
        for (const host of result) {
          handlers.push(this.deleteHost(host.attrs.name));
        }

        await Promise.all(handlers);
        resolve(true);
      });
    });
  }
}
