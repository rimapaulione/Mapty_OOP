'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  constructor(distance, duration, coords, location) {
    this.distance = distance; //km
    this.duration = duration; //min
    this.coords = coords; // [lat, long]
    this.location = location;
  }
  _description() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = ` ${this.type[0].toUpperCase()}${this.type.slice(
      1
    )} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  constructor(distance, duration, coords, location, cadence) {
    super(distance, duration, coords, location);
    this.cadence = cadence;
    this.type = 'running';
    this.calcPace();
    this._description();
  }
  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  constructor(distance, duration, coords, location, elevationGain) {
    super(distance, duration, coords, location);
    this.elevationGain = elevationGain;
    this.type = 'cycling';
    this.calcSpeed();
    this._description();
  }
  calcSpeed() {
    //km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const deleteAllBtn = document.querySelector('.menu__option--delete');
const deleteConfirmation = document.querySelector('.delete-confirmation');
const btnYes = document.querySelector('.delete-confirmation__btn--yes');
const btnNo = document.querySelector('.delete-confirmation__btn--no');
const btnSort = document.querySelector('.menu__option--sort');
const btnShowAll = document.querySelector('.menu__option--show');

const containerSpinner = document.querySelector('.spinner__container');

const errorWindow = document.querySelector('.error__window');
const errorMessage = document.querySelector('.error__message');
const overlay = document.querySelector('.overlay');
const errorBtnClose = document.querySelector('.btn__close--window');

///APP Architecture
class App {
  #map;
  #mapEvent;
  #workouts = [];
  #layer = [];
  #sorted = true;
  #errorMessage = 'Something went wrong';
  constructor() {
    //Render Spinner
    this._renderSpinner();
    //Get Users Position
    this._getPosition();
    //Get data from local IPA
    this._getLocalStorage();

    //Atached event handler
    inputType.addEventListener('change', this._taggleElevationField);

    form.addEventListener('submit', e => {
      this._newWorkout(e);
    });
    containerWorkouts.addEventListener('click', e => {
      if (e.target.classList.contains('remove_btn')) {
        this._deleteOneWorkout(e.target);
      } else {
        this._moveToPopup(e.target);
      }
    });
    [deleteAllBtn, btnNo].map(btn =>
      btn.addEventListener('click', this._renderDeleteConfirmation.bind(this))
    );
    btnYes.addEventListener('click', this._deleteAllWorkouts.bind(this));
    btnSort.addEventListener('click', this._sortWorkouts.bind(this));
    btnShowAll.addEventListener('click', this._showAllOnMap.bind(this));

    errorBtnClose.addEventListener('click', this._toggleWindow.bind(this));
    overlay.addEventListener('click', this._toggleWindow.bind(this));
  }
  _renderSpinner(position = 'afterbegin') {
    const markup = `
      <div class="spinner__icon"> </div>
    `;
    containerSpinner.insertAdjacentHTML(position, markup);
  }
  _hideSpinner() {
    document.querySelector('.spinner__icon').remove();
  }

  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      this._renderError.bind(this)
    );
  }
  _loadMap(position) {
    this._hideSpinner();
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, 10);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
    //Render current position marker
    this._renderCurentPositionMarker(coords);
  }
  _showForm(mapE) {
    if (!mapE) return;
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _taggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }
  async _newWorkout(e) {
    e.preventDefault();
    //Get date from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    const location = await this._getLocation(lat, lng);

    let workout;
    //check if data is valid
    const validInputs = function (...inputs) {
      return inputs.every(inp => Number.isFinite(inp));
    };
    const positiveInputs = (...inputs) => inputs.every(inp => inp > 0);

    //If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      //check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !positiveInputs(distance, duration, cadence)
      ) {
        this._renderError.call(this, {
          message: 'Inputs have to be positive numbers',
        });
        return;
      }

      //create running object
      workout = new Running(distance, duration, [lat, lng], location, cadence);
    }

    //If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      //check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !positiveInputs(distance, duration)
      ) {
        this._renderError.call(this, {
          message: 'Inputs have to be positive numbers',
        });
        return;
      }
      //create cycling object
      workout = new Cycling(
        distance,
        duration,
        [lat, lng],
        location,
        elevation
      );
    }

    //Add new object to workout array
    this.#workouts.push(workout);

    //Render workout on map as marker
    this._renderWorkoutMarker(workout);

    //Render workout on list
    this._renderWorkout(workout);

    //Hide form + Clear input fields
    this._hideForm();

    //Set local storage to all workouts
    this._setLocalStorage();
  }
  _renderWorkout(workout) {
    let html = `
            <li class="workout workout--${workout.type}" data-id=${workout.id}>
                <div class="workout__setup">
                <h3 class="workout__location"> ${workout.location}</h3>
                
                <button class="remove_btn">x</button>
              
                
                </div>
                <h2 class="workout__title">${workout.description}</h2>
                <div class="workout__details">
                     <span class="workout__icon">${
                       workout.type === 'running' ? '🏃 ' : '🚴‍♀️ '
                     }</span>
                     <span class="workout__value">${workout.distance}</span>
                        <span class="workout__unit">km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⏱</span>
                    <span class="workout__value">${workout.duration}</span>
                    <span class="workout__unit">min</span>
                </div>
            `;
    if (workout.type === 'running')
      html += `
                    <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.pace.toFixed(
                      1
                    )}</span>
                    <span class="workout__unit">min/km</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">🦶🏼</span>
                    <span class="workout__value">${workout.cadence}</span>
                    <span class="workout__unit">spm</span>
                 
                </div>
            </li>
                `;
    if (workout.type === 'cycling')
      html += `
                    <div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.speed.toFixed(
                      1
                    )}</span>
                    <span class="workout__unit">km/h</span>
                </div>
                <div class="workout__details">
                    <span class="workout__icon">⛰</span>
                    <span class="workout__value">${workout.elevationGain}</span>
                    <span class="workout__unit">m</span>
                </div>
                
            </li>
            `;
    form.insertAdjacentHTML('afterend', html);
  }
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords).addTo(this.#map);
    this.#layer.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃 ' : '🚴‍♀️ '} ${workout.description}`
      )
      .openPopup();
  }
  _renderCurentPositionMarker(coords) {
    L.marker(coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
        })
      )
      .setPopupContent(`You are here :)`)
      .openPopup();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);

    form.dataset.id = '';
  }

  _moveToPopup(eTarget) {
    const workoutEl = eTarget.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, 13, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    if (eTarget.classList.contains('edit_btn')) {
      this._editWorkout(eTarget);
    }
  }
  _showAllOnMap() {
    if (this.#workouts.length === 0) return;
    const latlngs = this.#workouts.map(work => work.coords);
    const polygon = L.polygon(latlngs, { color: 'none' }).addTo(this.#map);
    // zoom the map to the polygon
    this.#map.fitBounds(polygon.getBounds());
  }
  _renderDeleteConfirmation() {
    if (this.#workouts.length === 0) return;
    deleteConfirmation.classList.toggle('delete-confirmation--hidden');
  }
  _deleteAllWorkouts() {
    this.#workouts = [];
    const containerWorkoutsArr = [...containerWorkouts.children];

    containerWorkoutsArr.forEach(workout => {
      if (workout.classList.contains('workout')) {
        workout.remove();
      }
    });
    this.#layer.forEach(lay => {
      lay.remove();
    });
    this.#layer = [];
    localStorage.removeItem('Workouts');
    deleteConfirmation.classList.toggle('delete-confirmation--hidden');
  }
  _deleteOneWorkout(eTarget) {
    const workoutEl = eTarget.closest('.workout');
    if (!workoutEl) return;
    workoutEl.remove();
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutEl.dataset.id
    );
    this.#workouts.splice(workoutIndex, 1);
    this.#layer[workoutIndex].remove();
    this.#layer.splice(workoutIndex, 1);
    this._setLocalStorage();
  }
  _sortWorkouts() {
    const containerWorkoutsArr = [...containerWorkouts.children];
    containerWorkoutsArr.forEach(workout => {
      if (workout.classList.contains('workout')) {
        workout.remove();
      }
    });

    const arr = this.#sorted
      ? this.#workouts.slice().sort((a, b) => a.distance - b.distance)
      : this.#workouts;

    arr.forEach(workout => {
      this._renderWorkout(workout);
    });

    this.#sorted = !this.#sorted;
  }

  async _getLocation(lat, lng) {
    try {
      const response = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json`
      );
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const data = await response.json();
      return `${data.city}, ${data.country}`;
    } catch (err) {
      //alert(`Something went wrong!!!!!! ${err.message}`);
      throw new Error('Can not get location');
    }
  }

  _setLocalStorage() {
    localStorage.setItem('Workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('Workouts'));
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => this._renderWorkout(work));
  }
  _toggleWindow() {
    overlay.classList.toggle('hidden');
    errorWindow.classList.toggle('hidden');
    this._hideForm();
  }

  _renderError(error) {
    errorMessage.innerHTML = '';
    const markup = `
        <div class="error">
      
            <p>❌ ${error.message} ❌</p>
        </div>
      `;
    this._toggleWindow();
    errorMessage.insertAdjacentHTML('afterbegin', markup);
  }
}

const app = new App();
