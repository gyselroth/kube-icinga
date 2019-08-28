import {Logger} from 'winston';
import {Service as KubeService} from 'kubernetes-types/core/v1';

/**
 * kubernetes hosts
 */
export default abstract class Resource {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Replace invalid icinga2 chars
   */
  protected escapeName(name: string): string {
    return name.replace(/\\|\//g, '-');
  }

  /**
   * Prepare icinga object with kube annotations
   */
  protected prepareResource(resource: any): any {
    let definition: any = {};

    if (!resource.metadata.annotations) {
      return definition;
    }

    let annotations = resource.metadata.annotations;

    if (annotations['kube-icinga/check_command']) {
      definition.check_command = annotations['kube-icinga/check_command'];
    }

    if (annotations['kube-icinga/definition']) {
      Object.assign(definition, JSON.parse(annotations['kube-icinga/definition']));
    }

    return definition;
  }

  /**
   * Prepare icinga object with kube annotations
   */
  protected prepareTemplates(resource: any): string[] {
    if (!resource.metadata.annotations) {
      return [];
    }

    let annotations: any = resource.metadata.annotations;

    if (annotations['kube-icinga/templates']) {
      return annotations['kube-icinga/templates'].split(',');
    }

    return [];
  }

  /**
   * Get annotations
   */
  protected getAnnotations(definition: KubeService): { [key: string]: string } {
    if (definition.metadata && definition.metadata.annotations) {
      return definition.metadata.annotations;
    }

    return {};
  }

  /**
   * Delete object
   */
  protected abstract deleteObject(object: any): Promise<boolean>;

  /**
   * Prepare object
   */
  protected abstract prepareObject(object: any): Promise<any>;

  /**
   * Check if we can continue with a given resource
   */
  protected async handleResource(kind: string, object: any, options: any): Promise<boolean> {
    if (object.object.kind !== kind) {
      this.logger.error('skip invalid '+kind+' object', {object: object});
      return false;
    }

    let disabled = object.object.metadata.annotations && object.object.metadata.annotations['kube-icinga/discover'] === 'false';
    let enabled = object.object.metadata.annotations && object.object.metadata.annotations['kube-icinga/discover'] === 'true';

    if (disabled === true) {
      this.logger.info('skip service object, kube-icinga/discover===false', {object: object});
      return false;
    }

    if (!options.discover && enabled !== true) {
      this.logger.debug('skip service object, since ['+object.object.spec.type+'] is not enabled for discover', {object: object});
      return false;
    }

    if (object.type == 'MODIFIED' || object.type == 'DELETED') {
      await this.deleteObject(object.object).catch((err) => {
        this.logger.error('failed to remove objects', {error: err});
      });
    }

    if (object.type == 'ADDED' || object.type == 'MODIFIED') {
      this.prepareObject(object.object).catch((err) => {
        this.logger.error('failed to handle resource', {error: err});
      });
    }

    return true;
  }
}
