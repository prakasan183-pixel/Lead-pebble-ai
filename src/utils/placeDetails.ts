export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface GooglePlaceDetails {
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  addressComponents?: GoogleAddressComponent[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text?: string };
  businessStatus?: string;
  types?: string[];
}

export interface NormalizedPlaceDetails {
  phoneNumber?: string;
  city?: string;
  state?: string;
  country?: string;
  businessStatus?: string;
  openingHours?: string[];
  description?: string;
  businessTypes?: string[];
}

export function normalizeGooglePlaceDetails(place: GooglePlaceDetails): NormalizedPlaceDetails {
  const components = place.addressComponents || [];
  const getComponent = (...types: string[]) =>
    components.find((component) => component.types?.some((type) => types.includes(type)));

  const city =
    getComponent('locality', 'postal_town', 'administrative_area_level_3')?.longText;
  const state = getComponent('administrative_area_level_1')?.longText;
  const country = getComponent('country')?.longText;
  const description = place.editorialSummary?.text?.trim();
  const openingHours = place.regularOpeningHours?.weekdayDescriptions
    ?.map((line) => line.trim())
    .filter(Boolean);
  const businessTypes = [...new Set((place.types || [])
    .filter((type) => type !== 'establishment' && type !== 'point_of_interest')
    .map((type) => type.replace(/_/g, ' ')))];

  return {
    phoneNumber: place.internationalPhoneNumber || place.nationalPhoneNumber,
    city,
    state,
    country,
    businessStatus: place.businessStatus,
    openingHours: openingHours?.length ? openingHours : undefined,
    description: description || undefined,
    businessTypes: businessTypes.length ? businessTypes : undefined,
  };
}
