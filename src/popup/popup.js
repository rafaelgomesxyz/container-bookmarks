let info = {};

const titleHeader = document.getElementById('title-header');
const nameField = document.getElementById('name-field');
const urlField = document.getElementById('url-field');
const folderDropdown = document.getElementById('folder-dropdown');
const containerDropdown = document.getElementById('container-dropdown');
const warningSection = document.getElementById('warning-section');
const warningLink = document.getElementById('warning-link');
const cancelButton = document.getElementById('cancel-button');
const doneButton = document.getElementById('done-button');

containerDropdown.addEventListener('change', onContainerDropdownChanged);
cancelButton.addEventListener('click', onCancelButtonClicked);
doneButton.addEventListener('click', onDoneButtonClicked);

getInfo();

async function getInfo() {
  try {
    info = await browser.runtime.sendMessage({
      action: 'get-info',
    });

    const title = info.isEdit ? 'Edit Container Bookmark' : 'New Container Bookmark';
    document.title = title;
    titleHeader.textContent = title;

    nameField.value = info.name;
    urlField.value = info.url;

    addOptions(folderDropdown, info.folders);
    addOptions(containerDropdown, info.containers);

    folderDropdown.value = info.parentId;
    containerDropdown.value = info.containerId;

    onContainerDropdownChanged();
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when retrieving the bookmark. Check the console log for more info.');
  }
}

async function onContainerDropdownChanged() {
  let height = 0;

  if (containerDropdown.value === 'none') {
    height = 350;

    warningSection.classList.add('hidden');
  } else {
    height = 450;

    warningSection.classList.remove('hidden');

    const url = `http://www.${containerDropdown.value}.${info.preferences['redirect-key'].value}`;
    warningLink.setAttribute('href', url);
    warningLink.textContent = url;
  }

  try {
    await browser.runtime.sendMessage({
      action: 'resize-window',
      windowId: info.windowId,
      width: 375,
      height: height,
    });
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when resizing the window. Check the console log for more info.');
  }
}

async function onCancelButtonClicked() {
  try {
    if (!info.isEdit) {
      await browser.runtime.sendMessage({
        action: 'remove-bookmark',
        id: info.id,
      });
    }

    window.close();
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when removing the bookmark. Check the console log for more info.');
  }
}

async function onDoneButtonClicked() {
  try {
    await browser.runtime.sendMessage({
      action: 'add-bookmark',
      id: info.id,
      old: {
        parentId: info.parentId,
        title: info.name,
        url: info.url,
      },
      new: {
        parentId: folderDropdown.value,
        title: nameField.value,
        url: containerDropdown.value === 'none' ? urlField.value : `${urlField.value.replace(new RegExp(`#${info.preferences['redirect-key'].value}-(.*)`), '')}#${info.preferences['redirect-key'].value}-${containerDropdown.value}`,
      },
    });

    window.close();
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when adding the bookmark. Check the console log for more info.');
  }
}

/**
 * @param {HTMLSelectElement} dropdown
 * @param {OptionDetails[]} options
 * @param {Number} level
 */
function addOptions(dropdown, options, level = 0) {
  for (const option of options) {
    const optionElement = document.createElement('option');
    optionElement.value = option.id;
    optionElement.textContent = `${'-'.repeat(level)} ${option.name}`;

    dropdown.appendChild(optionElement);

    if (option.children && option.children.length > 0) {
      addOptions(dropdown, option.children, level + 2);
    }
  }
}