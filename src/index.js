import * as common from 'launchdarkly-js-sdk-common';
import browserPlatform from './browserPlatform';
import GoalManager from './GoalManager';

const goalsEvent = 'goalsReady';
const extraOptionDefs = {
  fetchGoals: { default: true },
  hash: { type: 'string' },
  eventUrlTransformer: { type: 'function' },
};

// Pass our platform object to the common code to create the browser version of the client
export function initialize(env, user, options = {}) {
  const platform = browserPlatform(options);
  const clientVars = common.initialize(env, user, options, platform, extraOptionDefs);

  const client = clientVars.client;
  const validatedOptions = clientVars.options;
  const emitter = clientVars.emitter;

  const goalsPromise = new Promise(resolve => {
    const onGoals = emitter.on(goalsEvent, () => {
      emitter.off(goalsEvent, onGoals);
      resolve();
    });
  });
  client.waitUntilGoalsReady = () => goalsPromise;

  if (validatedOptions.fetchGoals) {
    const goalManager = GoalManager(clientVars, () => emitter.emit(goalsEvent));
    platform.customEventFilter = goalManager.goalKeyExists;
  } else {
    emitter.emit(goalsEvent);
  }

  if (document.readyState !== 'complete') {
    window.addEventListener('load', clientVars.start);
  } else {
    clientVars.start();
  }

  // We'll attempt to flush events via synchronous HTTP if the page is about to close, to improve
  // the chance that the events will really be delivered, although synchronous requests aren't
  // supported in all browsers (see httpRequest.js). We will do it for both beforeunload and
  // unload, in case any events got generated by code that ran in another beforeunload handler.
  // We will not call client.close() though, since in the case of a beforeunload event the page
  // might not actually get closed, and with an unload event we know everything will get discarded
  // anyway.
  const syncFlushHandler = () => {
    platform.synchronousFlush = true;
    client.flush().catch(() => {});
  };
  window.addEventListener('beforeunload', syncFlushHandler);
  window.addEventListener('unload', syncFlushHandler);

  return client;
}

export const createConsoleLogger = common.createConsoleLogger;

export const version = VERSION;

function deprecatedInitialize(env, user, options = {}) {
  console && console.warn && console.warn(common.messages.deprecated('default export', 'named LDClient export'));
  return initialize(env, user, options);
}

export default { initialize: deprecatedInitialize, version };
