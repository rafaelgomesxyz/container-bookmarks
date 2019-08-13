const info = {
  preferences: {
    'redirect-key': {
      name: 'Redirect Key',
      description: 'The key that is used to trigger the redirect. For example, the default redirect key is "container", which appends "#container-%name%" to the end of the original URL and makes "http://www.%name%.container/%original-url%" the redirect URL.',
      defaultValue: 'container',
      value: 'container',
    },
  },
};

let wasInternallyCreated = false;

getPreferences().then(() => {
  browser.bookmarks.onCreated.addListener(onBookmarkCreated);
  browser.menus.onClicked.addListener(onMenuClicked);
  browser.webRequest.onBeforeRequest.addListener(onBeforeRequest, {
    urls: ['<all_urls>'],
    types: ['main_frame'],
  }, ['blocking']);

  browser.runtime.onMessage.addListener(onMessageReceived);

  browser.menus.create({
    id: 'edit-bookmark',
    icons: {
      '48': 'icon.png',
    },
    title: 'Edit Container Bookmark',
    contexts: ['bookmark'],
  });
});

async function getPreferences() {
  try {
    const defaultValues = {};
    for (const key in info.preferences) {
      defaultValues[key] = info.preferences[key].defaultValue;
    }

    const values = await browser.storage.sync.get(defaultValues);

    for (const key in values) {
      info.preferences[key].value = values[key];
    }
  } catch (error) {
    console.log(error);
  }
}

async function onMessageReceived(message) {
  let response = null;

  switch (message.action) {
    case 'get-info': {
      await getPreferences();

      info.folders = [];
      info.containers = [];

      const tree = await browser.bookmarks.getTree();
      for (const node of tree[0].children) {
        const folder = getFolder(node);
        if (folder) {
          info.folders.push(folder);
        }
      }

      const containers = await browser.contextualIdentities.query({});
      for (const container of containers) {
        info.containers.push({
          id: getContainerId(container.name),
          name: container.name,
        });
      }

      response = info;

      break;
    }
    case 'get-preferences': {
      response = info.preferences;

      break;
    }
    case 'set-preferences': {
      await browser.storage.sync.set(message.preferences);

      await getPreferences();

      break;
    }
    case 'remove-bookmark': {
      if (await bookmarkExists(message.id)) {
        await browser.bookmarks.remove(message.id);
      }

      break;
    }
    case 'add-bookmark': {
      if (await bookmarkExists(message.id)) {
        if (message.old.title !== message.new.title || message.old.url !== message.new.url) {
          await browser.bookmarks.update(message.id, {
            title: message.new.title,
            url: message.new.url,
          });
        }

        if (message.old.parentId !== message.new.parentId) {
          await browser.bookmarks.move(message.id, {
            parentId: message.new.parentId,
          });
        }
      } else {
        wasInternallyCreated = true;

        await browser.bookmarks.create({
          title: message.new.title,
          url: message.new.url,
          parentId: message.new.parentId,
        });
      }

      break;
    }
    case 'resize-window': {
      if (await windowExists(message.windowId)) {
        await browser.windows.update(message.windowId, {
          width: message.width,
          height: message.height,
        });
      }

      break;
    }
  }

  return response;
}

async function onBookmarkCreated(id, bookmark, isEdit) {
  if (wasInternallyCreated) {
    wasInternallyCreated = false;
  } else if (bookmark.type === 'bookmark') {
    info.id = id;
    info.name = bookmark.title;
    info.url = bookmark.url;
    info.parentId = bookmark.parentId;

    const matches = info.url.match(new RegExp(`#${info.preferences['redirect-key'].value}-(.*)`));
    info.containerId = matches ? matches[1] : 'none';

    info.isEdit = isEdit;

    info.windowId = (await browser.windows.create({
      url: `${browser.runtime.getURL('./popup/popup.html')}`,
      type: 'popup',
      width: 375,
      height: 350,
    })).id;
  }
}

async function onMenuClicked(menuInfo) {
  if (menuInfo.menuItemId === 'edit-bookmark') {
    const bookmark = (await browser.bookmarks.get(menuInfo.bookmarkId))[0];
    onBookmarkCreated(bookmark.id, bookmark, true);
  }
}

function onBeforeRequest(details) {
  const response = {};

  const url = details.url;

  const matches = url.match(new RegExp(`((.*)#${info.preferences['redirect-key'].value}-(.*))|(http://(www\.)?.*\.${info.preferences['redirect-key'].value}\/(.*))`));
  if (matches) {
    if (matches[1]) {
      response.redirectUrl = `http://www.${matches[3]}.${info.preferences['redirect-key'].value}/${matches[2]}`;
    } else if (matches[4]) {
      response.redirectUrl = matches[6];
    }
  }

  return response;
}

/**
 * @param {NodeDetails} node
 * @return {OptionDetails}
 */
function getFolder(node) {
  let folder = null;

  if (node.type === 'folder') {
    folder = {
      id: node.id,
      name: node.title,
    };

    if (node.children) {
      folder.children = [];

      for (const childNode of node.children) {
        const childFolder = getFolder(childNode);
        if (childFolder) {
          folder.children.push(childFolder);
        }
      }
    }
  }

  return folder;
}

/**
 * @param {String} name
 * @return {String}
 */
function getContainerId(name) {
  return name
    .toLowerCase()
    .replace(/\s/g, '-');
}

/**
 * @param {String} id
 * @return {Promise<Boolean>}
 */
async function bookmarkExists(id) {
  let exists = false;

  try {
    exists = !!(await browser.bookmarks.get(id))[0];
  } catch (error) {
    console.log(error);
  }

  return exists;
}

/**
 * @param {String} id
 * @return {Promise<Boolean>}
 */
async function windowExists(id) {
  let exists = false;

  try {
    exists = !!(await browser.windows.get(id));
  } catch (error) {
    console.log(error);
  }

  return exists;
}