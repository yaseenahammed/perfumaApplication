
function setupAddressAutocomplete({ inputId, suggestionId, cityId, stateId, countryId, pincodeId, phoneId }) {
  const addressInput = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionId);

  if (!addressInput || !suggestions) {
    console.warn(` Input or suggestion element not found for ${inputId}`);
    return;
  }

  addressInput.addEventListener("input", async function () {
    const query = this.value.trim();
    if (query.length < 3) {
      suggestions.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();

      suggestions.innerHTML = "";

      if (!data.features || data.features.length === 0) return;

      data.features.forEach(item => {
        const props = item.properties;

        const fullAddress = [
          props.name,
          props.street,
          props.city,
          props.state,
          props.country
        ].filter(Boolean).join(", ");

        const li = document.createElement("li");
        li.style.cursor = "pointer";
        li.style.padding = "5px";
        li.innerText = fullAddress;

       li.addEventListener("click", () => {
  addressInput.value = fullAddress;
  suggestions.innerHTML = "";


  validateAddress(item.geometry.coordinates[1], item.geometry.coordinates[0], { cityId, stateId, countryId, pincodeId, phoneId });
});


        suggestions.appendChild(li);
      });
    } catch (err) {
      console.error(" Error fetching suggestions:", err);
    }
  });
}



async function validateAddress(lat, lon, { cityId, stateId, countryId, pincodeId, phoneId }) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
    );
    const data = await res.json();

    if (data && data.address) {
      const addr = data.address;

      if (cityId && addr.city && document.getElementById(cityId)) {
        document.getElementById(cityId).value = addr.city;
      }
      if (stateId && addr.state && document.getElementById(stateId)) {
        document.getElementById(stateId).value = addr.state;
      }
      if (countryId && addr.country && document.getElementById(countryId)) {
        document.getElementById(countryId).value = addr.country;
      }
      if (pincodeId && addr.postcode && document.getElementById(pincodeId)) {
        document.getElementById(pincodeId).value = addr.postcode;
      }
    } else {
      console.warn("Address could not be validated");
    }

  
    if (phoneId && document.getElementById(phoneId)) {
      const phoneInput = document.getElementById(phoneId);
      phoneInput.addEventListener("input", () => {
        const phonePattern = /^[0-9]{10}$/;
        if (!phonePattern.test(phoneInput.value)) {
          phoneInput.setCustomValidity("Enter a valid 10-digit phone number");
        } else {
          phoneInput.setCustomValidity("");
        }
      });
    }
  } catch (err) {
    console.error("Error validating address:", err);
  }
}

