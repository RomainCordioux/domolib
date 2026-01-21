const fs = require('fs');
const axios = require('axios');

/**
 * CONFIGURATION VIA VARIABLES D'ENVIRONNEMENT
 */
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ""; 
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX || ""; 

/**
 * URL SOURCE MISE À JOUR
 * On cible le fichier de définitions Xiaomi pour extraire des produits réels.
 */
const ZIGBEE_SOURCE = "https://raw.githubusercontent.com/Koenkk/zigbee-herdsman-converters/master/src/devices/xiaomi.ts";
const ZIGBEE_SOURCE_ALT = "https://raw.githubusercontent.com/Koenkk/zigbee-herdsman-converters/master/src/devices/tuya.ts";

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Recherche d'image via Google Custom Search
 */
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

/**
 * Détection de catégorie basée sur la description
 */
function detectCategory(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes('bulb') || d.includes('light') || d.includes('led')) return "Éclairage";
  if (d.includes('sensor') || d.includes('motion') || d.includes('contact')) return "Sécurité";
  if (d.includes('plug') || d.includes('switch') || d.includes('outlet')) return "Énergie";
  if (d.includes('thermostat') || d.includes('valve')) return "Chauffage";
  return "Accessoires";
}

async function run() {
  console.log("🚀 Téléchargement du catalogue Zigbee2MQTT...");
  
  let content = "";
  try {
    const response = await axios.get(ZIGBEE_SOURCE, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    content = response.data;
  } catch (error) {
    console.log("⚠️ Échec sur la source Xiaomi, tentative sur Tuya...");
    try {
      const responseAlt = await axios.get(ZIGBEE_SOURCE_ALT, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      content = responseAlt.data;
    } catch (errAlt) {
      console.error("❌ Erreur lors de l'agrégation : Impossible de trouver un fichier source valide.");
      process.exit(1);
    }
  }

  try {
    /**
     * Regex adaptée à la structure des fichiers de définitions (.ts)
     */
    const regex = /model:\s*['"]([^'"]+)['"][\s\S]*?vendor:\s*['"]([^'"]+)['"][\s\S]*?description:\s*['"]([^'"]+)['"]/g;
    
    let match;
    const rawProducts = [];

    while ((match = regex.exec(content)) !== null && rawProducts.length < 15) {
      rawProducts.push({
        model: match[1],
        vendor: match[2],
        description: match[3]
      });
    }

    if (rawProducts.length === 0) {
      throw new Error("Aucun produit n'a pu être extrait. La structure du code source a changé.");
    }

    console.log(`📦 ${rawProducts.length} produits extraits. Début de l'enrichissement...`);

    const finalProducts = [];

    for (const raw of rawProducts) {
      const searchQuery = `${raw.vendor} ${raw.model} ${raw.description} smart home`;
      console.log(`🔍 Recherche pour : ${raw.vendor} ${raw.model}`);

      await delay(1200); 

      const image = await fetchProductImage(searchQuery);
      
      finalProducts.push({
        id: `zig-${raw.model}-${Math.floor(Math.random() * 1000)}`,
        nom: raw.description,
        marque: raw.vendor,
        categorie: detectCategory(raw.description),
        protocoles: ["Zigbee"],
        ecosystemes: ["Zigbee2MQTT", "Home Assistant"],
        alimentation: raw.description.toLowerCase().includes('battery') ? "Pile" : "Secteur",
        image: image,
        note: (Math.random() * (5 - 4.2) + 4.2).toFixed(1),
        prix: `${(Math.random() * 35 + 15).toFixed(2)}€`
      });
    }

    fs.writeFileSync('./products_db.json', JSON.stringify(finalProducts, null, 2));
    console.log("🏁 products_db.json généré avec succès !");

  } catch (error) {
    console.error("❌ Erreur lors de l'agrégation :", error.message);
    process.exit(1);
  }
}

run();
