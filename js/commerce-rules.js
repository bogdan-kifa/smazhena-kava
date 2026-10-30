/* Shared catalogue contract for browser and server. Prices are in kopecks. */
((create) => {
  if (typeof module === "object" && module.exports) module.exports = create();
  else window.CoffeeRules = create();
})(() => Object.freeze({
  weights: Object.freeze([100,200,250,500,1000,2000]),
  productWeights: Object.freeze([250,500,1000]),
  grinds: Object.freeze({beans:"У зернах",espresso:"Еспресо",filter:"Фільтр",cezve:"Джезва"}),
  roasts: Object.freeze({light:"Світле",medium:"Середнє",dark:"Темне"}),
  packaging: Object.freeze({
    1:Object.freeze({name:"Пакет із клапаном",price:0}),
    2:Object.freeze({name:"Подарункова коробка",price:4000}),
    3:Object.freeze({name:"Багаторазова банка",price:8000})
  }),
  available: (product) => Boolean(product) && product.available !== false && product.availability !== "unavailable"
}));
