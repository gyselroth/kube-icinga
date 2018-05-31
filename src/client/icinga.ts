import * as IcingaApi from 'icinga2-api';
import config from '../config';

const icingaClient = new IcingaApi(config.icinga.address, config.icinga.port, config.icinga.apiUser, config.icinga.apiPassword);
export default icingaClient;
