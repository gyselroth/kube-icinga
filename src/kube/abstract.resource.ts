import {Logger} from 'winston';
import Icinga from '../icinga';
import JSONStream from 'json-stream';

/**
 * kubernetes hosts
 */
export default abstract class Resource {
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
    var definition: any = {};

    if(!resource.metadata.annotations) {
        return definition;
    }

    var annotations: any = resource.metadata.annotations;

    if(annotations['kube-icinga/check_command']) {
      definition.check_command = annotations['kube-icinga/check_command'];  
    }
    
    if(annotations['kube-icinga/definition']) {
      Object.assign(definition, JSON.parse(annotations['kube-icinga/definition']));  
    }
  
    return definition;
  }

  /**
   * Prepare icinga object with kube annotations
   */
  protected prepareTemplates(resource: any): string[] {
    if(!resource.metadata.annotations) {
        return [];
    }

    var annotations: any = resource.metadata.annotations;
    
    if(annotations['kube-icinga/templates']) {
     return annotations['kube-icinga/templates'].split(',');  
    }

    return [];
  }
}
