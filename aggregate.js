const fs = require('fs');
const axios = require('axios');

/**
 * CONFIGURATION VIA VARIABLES D'ENVIRONNEMENT
 * Les clés sont récupérées depuis les secrets GitHub
 */
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ""; 
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || ""; 

const SOURCES = {
  ZIGBEE: "https://raw.githubusercontent.com/Koenkk/zigbee-herdsman-converters/master/src/devices/index.js",
  MATTER: "https://webui.dcl.csa-iot.org/api/v1/model"
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchProductImage(query) {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_CX) return "https://via.placeholder.com/300?text=Config+Manquante";

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}&searchType=image&num=1`;
    const response = await axios.get(url);
    return response.data.items?.[0]?.link || "https://via.placeholder.com/300?text=Image+Non+Trouvee";
  } catch (error) {
    return "https://via.placeholder.com/300?text=Erreur+API";
  }
}

async function fetchPrice(productName, brand) {
  // Simulation de prix pour l'exemple
  const basePrices = { 'IKEA': 15, 'Philips Hue': 50, 'Aqara': 25, 'Sonoff': 12, 'TP-Link': 30 };
  const base = basePrices[brand] || 20;
  return `${(base + Math.random() * 15).toFixed(2)}€`;
}

async function normalizeProduct(raw, source) {
  const brand = source === 'ZIGBEE' ? raw.vendor : raw.vendorName;
  const name = source === 'ZIGBEE' ? (raw.description || raw.model) : raw.productName;
  const searchQuery = `${brand} ${name} domotique`;

  // Respect du quota Google (max 100/jour en gratuit)
  await delay(1000); 

  const [image, prix] = await Promise.all([
    fetchProductImage(searchQuery),
    fetchPrice(name, brand)
  ]);

  return {
    id: source === 'ZIGBEE' ? `zig-${raw.model}` : `mat-${raw.deviceTypeId}`,
    nom: name,
    marque: brand,
    categorie: detectCategory(source === 'ZIGBEE' ? raw.description : ""),
    protocoles: source === 'ZIGBEE' ? ["Zigbee"] : ["Matter", "Thread"],
    ecosystemes: source === 'ZIGBEE' ? ["Zigbee2MQTT"] : ["Apple Home", "Google Home"],
    alimentation: (raw.description || "").toLowerCase().includes('battery') ? "Pile" : "Secteur",
    image: image,
    note: (Math.random() * (5 - 4) + 4).toFixed(1),
    prix: prix
  };
}

function detectCategory(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes('bulb') || d.includes('light')) return "Éclairage";
  if (d.includes('sensor') || d.includes('motion')) return "Sécurité";
  if (d.includes('plug') || d.includes('switch')) return "Énergie";
  return "Accessoires";
}

async function run() {
  console.log("🚀 Début de l'agrégation des produits...");
  
  // Données de test (à remplacer par de vrais fetch sur les URLs de SOURCES plus tard)
  const samples = [
    { source: 'ZIGBEE', data: { model: 'LED1545G12', vendor: 'IKEA', description: 'TRADFRI LED bulb' } },
    { source: 'ZIGBEE', data: { model: 'SNZB-02', vendor: 'Sonoff', description: 'Temperature sensor' } },
    { source: 'MATTER', data: { productName: 'Smart Plug Mini', vendorName: 'TP-Link', deviceTypeId: '123' } }
  ];

  const results = [];
  for (const item of samples) {
    try {
      const p = await normalizeProduct(item.data, item.source);
      results.push(p);
      console.log(`✅ Ajouté : ${p.marque} ${p.nom}`);
    } catch (e) {
      console.error(`❌ Erreur sur un produit :`, e.message);
    }
  }

  fs.writeFileSync('./products_db.json', JSON.stringify(results, null, 2));
  console.log("🏁 products_db.json a été généré avec succès !");
}

run();
