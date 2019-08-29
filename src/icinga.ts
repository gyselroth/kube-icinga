import {Logger} from 'winston';

export interface IcingaObject {
  [key: string]: any
};

/**
 * icinga wrapper
 */
export class Icinga {
  protected logger: Logger;
  protected icingaClient: any;
  protected triggerRestart: boolean=false;

  /**
   * icinga wrapper
   *
   * Note: icinga-api does not provide any typings
   */
  constructor(logger: Logger, icingaClient: any) {
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

        this.icingaClient.restartProcess((err: any, result: any) => {
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
      this.icingaClient.getCheckCommand(command, (err: any, result: any) => {
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

      this.icingaClient.getHostGroup(name, (err: any, result: any) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostGroup(name, name, [], (err: any, result: any) => {
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
  public applyServiceGroup(name: string, definition: any={}): Promise<boolean> {
    let group = {
      attrs: definition,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply service group ${name} aka kubernetes namespace`, {serviceGroup: group});

      this.icingaClient.getServiceGroup(name, (err: any, result: any) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`service group ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createServiceGroupCustom(JSON.stringify(group), name, (err: any, result: any) => {
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
  public applyHost(name: string, definition: IcingaObject={}, templates: string[]=[]): Promise<boolean> {
    let host = {
      attrs: definition,
      templates: templates,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply new host ${name}`, {host: host});

      this.icingaClient.getHostState(name, (err: any, result: any) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`host ${name} on monitoring was not found, create one`, {error: err});

            this.icingaClient.createHostCustom(JSON.stringify(host), name, (err: any, result: any) => {
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
  public applyService(host: string, name: string, definition: IcingaObject={}, templates: string[]=[]): Promise<boolean> {
    let service = {
      attrs: definition,
      templates: templates,
    };

    return new Promise((resolve, reject) => {
      this.logger.info(`apply service ${name} to host ${host}`, {service: definition});

      this.icingaClient.getService(host, name, (err: any, result: any) => {
        if (err) {
          if (err.Statuscode == '404') {
            this.logger.info(`service ${name} on host ${host} was not found, create one`, {error: err});

            this.icingaClient.createServiceCustom(JSON.stringify(service), host, name, (err: any, result: any) => {
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

      return this.icingaClient.deleteService(name, host, (err: any, result: any) => {
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

      this.icingaClient.deleteHost(name, (err: any, result: any) => {
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
      this.icingaClient.getServiceFiltered({filter: filter}, async (err: any, result: any) => {
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
      this.icingaClient.getHostFiltered({filter: filter}, async (err: any, result: any) => {
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
