import * as IcingaApi from 'icinga2-api';
import config from '../config';

const icingaClient = new IcingaApi(config.icinga.address || '127.0.0.1', config.icinga.port || 5661, config.icinga.apiUser || 'admin', config.icinga.apiPassword || 'admin');
export default icingaClient;
