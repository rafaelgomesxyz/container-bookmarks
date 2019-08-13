let preferences = {} ;

const form = document.getElementById('form');
const saveButton = document.getElementById('save-button');

saveButton.addEventListener('click', onSaveButtonClicked);

getPreferences();

async function getPreferences() {
  try {
    preferences = await browser.runtime.sendMessage({
      action: 'get-preferences',
    });

    for (const key in preferences) {
      const preference = preferences[key];

      const id = `${key}-preference`;

      const panelItem = document.createElement('div');
      panelItem.className = 'panel-formElements-item';

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = `${preference.name}:`;

      const field = document.createElement('input');
      field.id = id;
      field.type = 'text';
      field.value = preference.value;

      panelItem.appendChild(label);
      panelItem.appendChild(field);
      form.appendChild(panelItem);

      if (preference.description) {
        const section = document.createElement('div');
        section.className = 'panel-formElements-section';
        section.textContent = preference.description;

        form.appendChild(section);
      }
    }
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when retrieving preferences. Check the console log for more info.');
  }
}

async function onSaveButtonClicked() {
  try {
    const values = {};
    for (const key in preferences) {
      const field = document.getElementById(`${key}-preference`);
      values[key] = field.value;
    }

    await browser.runtime.sendMessage({
      action: 'set-preferences',
      preferences: values,
    });

    window.alert('Preferences saved with success!');
  } catch (error) {
    console.log(error);
    window.alert('An error occurred when saving preferences. Check the console log for more info.');
  }
}