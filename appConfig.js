// eslint-disable global-require
const path   = require('path');
const helmet = require('helmet');
const log    = require('metalogger')();
const healthcheck = require('maikai');
const hbs    = require('hbs');

require('app-module-path').addPath(path.join(__dirname,'/lib'));

// Add all routes and route-handlers for your service/app here:
function serviceRoutes(app) {
  // 활성 프로브를 위해서 정의
  // /ping 체크로 컨테이너가 살아있는지 확인
  const livenessCheck = healthcheck( { path: '/ping' });
  app.use(livenessCheck.express());
 
  // 준비성 프로브를 위해서 정의
  // /health 체크로 DB 연동 여부를 확인
  const check = healthcheck();
  const AdvancedHealthcheckers = require('healthchecks-advanced');
  const advCheckers = new AdvancedHealthcheckers();
  check.addCheck('db', 'dbQuery', advCheckers.dbCheck, {
    minCacheMs: 10000,
  });
  app.use(check.express());
 
  /* eslint-disable global-require */
 
  // app.use('/',      require('homedoc')); // attach to root route
  // app.use('/users', require('users')); // attach to sub-route
  app.use('/flights', require('flights'));
 
  /* eslint-enable global-require */
}

function setupErrorHandling(app) {
  // Custom formatting for error responses.
  app.use((err, req, res, next) => {
    if (err) {
      const out = {};
      if (err.isJoi || err.type === "validation") { //validation error. No need to log these
        out.errors = err.details;
        res.status(400).json(out); return;
      } else {
        log.error(err);
        if (process.env.NODE_ENV === "production") {
          out.errors = ["Internal server error"];
        } else {
          out.errors = [err.toString()];
        }
        res.status(500).json(out); return;
      }
    }
    return next();
  });
}

exports.setup = function(app, callback) {
  // Choose your favorite view engine(s)
  app.set('view engine', 'handlebars');
  app.engine('handlebars', hbs.__express);

  /** Adding security best-practices middleware
   * see: https://www.npmjs.com/package/helmet **/
   app.use(helmet());

  //---- Mounting well-encapsulated application modules (so-called: "mini-apps")
  //---- See: http://expressjs.com/guide/routing.html and http://vimeo.com/56166857
  serviceRoutes(app);

  setupErrorHandling(app);

  // If you need websockets:
  // let socketio = require('socket.io')(runningApp.http);
  // require('fauxchatapp')(socketio);

  if(typeof callback === 'function') {
    callback(app);
    return;
  }
};
