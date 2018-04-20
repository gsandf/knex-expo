import { map, clone } from 'lodash';
// eslint-disable-next-line
import { SQLite as driver } from 'expo';
import Promise from 'bluebird';

import ClientSQLite3 from './index';

module.exports = class ClientReactNativeSqliteStorage extends ClientSQLite3 {
  // dialect: 'sqlite';
  // driverName = 'expo-sqlite-storage';
  constructor(...args) {
    super(...args);

    this.dialect = 'sqlite';
    this.driverName = 'expo-sqlite-storage';
  }

  _driver() {
    // eslint-disable-line class-methods-use-this
    return driver;
  }

  acquireRawConnection() {
    const conn = Promise.cast(this.driver.openDatabase(this.connectionSettings.filename));
    return conn;
  }

  destroyRawConnection(db) {
    db.close().catch(err => {
      this.emit('error', err);
    });
  }

  _query(connection, obj) {
    // eslint-disable-line class-methods-use-this
    if (!connection) return Promise.reject(new Error('No connection provided.'));

    return new Promise((resolve, reject) => {
      connection.transaction(tx => {
        tx.executeSql(
          obj.sql,
          obj.bindings,
          (_, info) => {
            obj.response = {
              ...info,
              rows: info.rows._array
            };
            obj.response = info;
            resolve(obj);
          },
          reject
        );
      });
    });
  }

  _stream(connection, sql, stream) {
    const client = this;
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      return client // eslint-disable-line no-underscore-dangle
        ._query(connection, sql)
        .then(obj => client.processResponse(obj))
        .map(row => stream.write(row))
        .catch(err => stream.emit('error', err))
        .then(() => stream.end());
    });
  }

  processResponse(obj, runner) {
    // eslint-disable-line class-methods-use-this
    const resp = obj.response;
    if (obj.output) return obj.output.call(runner, resp);
    switch (obj.method) {
      case 'pluck':
      case 'first':
      case 'select': {
        let results = [];
        for (let i = 0, l = resp.rows.length; i < l; i++) {
          results[i] = clone(resp.rows.item(i));
        }
        if (obj.method === 'pluck') results = map(results, obj.pluck);
        return obj.method === 'first' ? results[0] : results;
      }
      case 'insert':
        return [resp.insertId];
      case 'delete':
      case 'update':
      case 'counter':
        return resp.rowsAffected;
      default:
        return resp;
    }
  }
};
