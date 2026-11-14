/*
 * AGRIXON plant library.
 *
 * Reference data for the crops used by the rotation planner. It is a field
 * guide, not a prescription: product choice, dose and timing must follow the
 * label and local extension advice. No pesticide doses are stored here.
 */
window.AGRIXON_PLANTS = [
  {
    id: 'winter-wheat',
    name: 'Winter wheat',
    family: 'Cereal · Poaceae',
    color: '#D6AC4D',
    rotation: 'Best after a non-cereal break crop (pea, rapeseed, beet). Avoid wheat after wheat: take-all and Septoria build up in residue.',
    sowing: 'Late summer to early autumn, when the soil is moist and the fly-free date has passed. 350–500 plants/m² depending on sowing date.',
    harvest: 'Late summer, at 14–15% grain moisture. Straw can be baled or chopped; chopping helps organic matter but keeps Fusarium residue.',
    gdd: 'Base 0 °C · about 1800 °C·d to maturity',
    water: '250–500 mm seasonal water; the flag-leaf to grain-fill window matters most.',
    diseases: [
      {
        name: 'Septoria tritici blotch',
        pathogen: 'Zymoseptoria tritici',
        symptoms: 'Irregular grey-green to necrotic lesions between veins; tiny black pycnidia inside older lesions. Starts on lower leaves and climbs the canopy.',
        prevention: 'Rotate away from wheat, bury or chop residue, grow resistant varieties, avoid very early sowing, control volunteer wheat.',
        treatment: 'Fungicide at flag leaf and ear emergence when the variety and weather justify it. Active ingredients include prothioconazole and tebuconazole; follow the label and resistance guidance.'
      },
      {
        name: 'Fusarium head blight',
        pathogen: 'Fusarium graminearum and related species',
        symptoms: 'Single spikelets or whole ears bleach prematurely; pink-orange sporulation appears in wet weather. Grain is shrivelled and may carry mycotoxins.',
        prevention: 'Keep maize residue away from the wheat block, rotate, choose less susceptible varieties, avoid dense canopies and late nitrogen.',
        treatment: 'A triazole fungicide at early flowering is the main ear-time tool. It reduces, but does not eliminate, mycotoxin risk; harvest and storage hygiene matter.'
      },
      {
        name: 'Brown rust',
        pathogen: 'Puccinia triticina',
        symptoms: 'Small round orange-brown pustules scattered on the upper leaf surface; pustules release orange dust when rubbed.',
        prevention: 'Resistant varieties, balanced nitrogen, avoid late sowing that extends the green-leaf period.',
        treatment: 'Fungicide when pustules reach the threshold on the upper leaves. Strobilurin and triazole actives are used; rotate modes of action.'
      }
    ],
    pests: [
      {
        name: 'Bird cherry-oat aphid',
        symptoms: 'Colonies on stems and lower leaves in autumn and spring; honeydew and sooty mould. The main risk is barley yellow dwarf virus (BYDV).',
        prevention: 'Delay autumn sowing, encourage natural enemies, avoid unnecessary insecticide that flares aphids.',
        treatment: 'Seed treatment or a threshold-based autumn spray where BYDV pressure is high. Follow local resistance and pollinator guidance.'
      },
      {
        name: 'Cereal leaf beetle',
        symptoms: 'Long narrow window-pane feeding strips between veins; larvae look like small dark slugs.',
        prevention: 'Rotation, residue management, early monitoring from stem elongation.',
        treatment: 'Treat only above the local threshold; broad-spectrum sprays also kill the parasitoids that keep the beetle in check.'
      }
    ],
    tips: [
      'Sow after the fly-free date to cut BYDV pressure.',
      'Split nitrogen: early tillering, stem elongation and flag leaf. Late nitrogen raises Fusarium risk.',
      'Walk the field at flag leaf and at flowering — those two windows decide most of the fungicide spend.'
    ]
  },
  {
    id: 'spring-wheat',
    name: 'Spring wheat',
    family: 'Cereal · Poaceae',
    color: '#E3BC60',
    rotation: 'A useful break from winter wheat, but still a cereal. Follow a broad-leaved crop where possible.',
    sowing: 'As early as the seedbed allows — spring wheat yields fall sharply with late sowing. 400–550 plants/m².',
    harvest: 'Late summer. Watch grain moisture and pre-harvest sprouting in wet years.',
    gdd: 'Base 0 °C · about 1600 °C·d to maturity',
    water: '220–450 mm; drought at booting and grain fill is the main yield limit.',
    diseases: [
      {
        name: 'Yellow rust',
        pathogen: 'Puccinia striiformis',
        symptoms: 'Bright yellow pustules in stripes along the veins; yellow dust on fingers. Cool, humid weather favours it.',
        prevention: 'Resistant varieties, avoid volunteer wheat, monitor from early spring.',
        treatment: 'Fungicide at first pustules; triazoles and SDHI mixtures are common. Rotate actives because rust adapts quickly.'
      },
      {
        name: 'Septoria tritici blotch',
        pathogen: 'Zymoseptoria tritici',
        symptoms: 'Necrotic leaf lesions with black pycnidia, usually after wet weather.',
        prevention: 'Residue management, rotation, resistant varieties, wider rows in high-pressure blocks.',
        treatment: 'Protect the flag leaf with a labelled fungicide if lesions are climbing the canopy.'
      },
      {
        name: 'Common bunt',
        pathogen: 'Tilletia tritici / T. laevis',
        symptoms: 'Ears look normal but grain is replaced by dark spore balls that smell of fish. Often noticed only at harvest.',
        prevention: 'Certified, treated seed; clean machinery; rotate away from infected fields.',
        treatment: 'Seed treatment is the practical control. Once the crop is infected there is no rescue spray.'
      }
    ],
    pests: [
      {
        name: 'Wheat midge',
        symptoms: 'Small orange larvae between the glumes; grain is shrivelled or missing. Adults fly at heading.',
        prevention: 'Avoid sowing wheat next to last year’s wheat, monitor with pheromone or sweep nets at heading.',
        treatment: 'Insecticide only if adults are above the local threshold at heading; timing is narrow.'
      },
      {
        name: 'Aphids',
        symptoms: 'Colonies on ears and upper leaves; honeydew. Direct feeding is usually minor, virus risk is not.',
        prevention: 'Natural enemies, late sowing where possible, avoid excess nitrogen.',
        treatment: 'Threshold-based spray; preserve predators and parasitoids.'
      }
    ],
    tips: [
      'Every week of sowing delay costs yield — prepare the seedbed in autumn.',
      'Do not push nitrogen beyond the protein target; lodging and disease rise.',
      'Spring wheat is a good fit after beet or potato, not after another cereal.'
    ]
  },
  {
    id: 'barley',
    name: 'Barley',
    family: 'Cereal · Poaceae',
    color: '#C6A17E',
    rotation: 'Good after broad-leaved crops. Avoid barley after barley — net blotch and scald survive on residue.',
    sowing: 'Spring barley as early as possible; winter barley in early autumn. 300–400 plants/m².',
    harvest: 'Early summer for winter barley, late summer for spring barley. Malting barley needs gentle, timely harvest.',
    gdd: 'Base 0 °C · about 1400 °C·d to maturity',
    water: '200–400 mm; malting barley is sensitive to excess late nitrogen and rain at harvest.',
    diseases: [
      {
        name: 'Net blotch',
        pathogen: 'Pyrenophora teres',
        symptoms: 'Brown net-like streaks on leaves; heavy infection kills the canopy early.',
        prevention: 'Rotate, bury residue, use resistant varieties, treat seed.',
        treatment: 'Fungicide from stem elongation when lesions appear; SDHI and triazole mixtures are common.'
      },
      {
        name: 'Scald',
        pathogen: 'Rhynchosporium commune',
        symptoms: 'Water-soaked grey-green lesions with a dark brown margin, usually on lower leaves first.',
        prevention: 'Residue management, rotation, resistant varieties, avoid dense stands.',
        treatment: 'Fungicide at first symptoms; protect the flag leaf.'
      },
      {
        name: 'Powdery mildew',
        pathogen: 'Blumeria graminis f. sp. hordei',
        symptoms: 'White fluffy patches on leaves and stems; later grey-brown cleistothecia.',
        prevention: 'Resistant varieties, avoid excessive nitrogen, open canopies.',
        treatment: 'Fungicide when mildew reaches the upper leaves; sulphur and triazoles are options.'
      }
    ],
    pests: [
      {
        name: 'Frit fly',
        symptoms: 'Dead central shoots in young barley; larvae inside the stem.',
        prevention: 'Early sowing, seed treatment where pressure is known, destroy volunteer cereals.',
        treatment: 'Seed treatment is more effective than a rescue spray.'
      },
      {
        name: 'Aphids',
        symptoms: 'Colonies on leaves and ears; BYDV risk in autumn-sown barley.',
        prevention: 'Delay autumn sowing, encourage natural enemies.',
        treatment: 'Threshold-based spray; avoid routine autumn insurance sprays.'
      }
    ],
    tips: [
      'For malting barley, stop nitrogen early and keep protein in the target band.',
      'Spring barley is the best smother crop for weeds — a dense, early canopy does the work.',
      'Do not sow barley after barley if net blotch was present.'
    ]
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    family: 'Aster · Asteraceae',
    color: '#D98C49',
    rotation: 'Needs a 4-year break from sunflower and other Asteraceae. Sclerotinia sclerotia survive for years in the soil.',
    sowing: 'When the soil at 5 cm is above 8–10 °C. 45,000–65,000 plants/ha depending on the hybrid.',
    harvest: 'Late summer to early autumn, at 9–12% seed moisture. Head timing matters more than leaf yellowing.',
    gdd: 'Base 6 °C · about 1400 °C·d to maturity',
    water: '300–550 mm; flowering and seed fill are the critical windows.',
    diseases: [
      {
        name: 'Downy mildew',
        pathogen: 'Plasmopara halstedii',
        symptoms: 'Stunted seedlings, pale green tissue, white down on the underside of leaves; plants may die early.',
        prevention: 'Resistant hybrids, certified seed, rotation, avoid low, wet spots.',
        treatment: 'Seed treatment with a labelled oomycete fungicide. Foliar sprays do not rescue infected plants.'
      },
      {
        name: 'Sclerotinia head rot',
        pathogen: 'Sclerotinia sclerotiorum',
        symptoms: 'Soft brown rot at the back of the head; white mycelium and black sclerotia inside. Heads may fall apart.',
        prevention: 'Long rotation, avoid dense canopies, control broad-leaved weeds, do not irrigate at flowering if avoidable.',
        treatment: 'Fungicide at flowering can reduce infection; timing and coverage of the head are critical.'
      },
      {
        name: 'Phoma black stem',
        pathogen: 'Phoma macdonaldii',
        symptoms: 'Black lesions at the stem base and leaf scars; stems may lodge late in the season.',
        prevention: 'Rotation, residue burial, resistant hybrids, balanced nutrition.',
        treatment: 'No reliable rescue spray; focus on rotation and stand health.'
      }
    ],
    pests: [
      {
        name: 'Sunflower moth',
        symptoms: 'Larvae tunnel into the head and feed on seeds; webbing and frass on the face of the head.',
        prevention: 'Early sowing, pheromone monitoring, rotation away from last year’s sunflower.',
        treatment: 'Insecticide at egg hatch or early larval stage; once larvae are inside the head it is too late.'
      },
      {
        name: 'Wireworms',
        symptoms: 'Seedlings cut below ground; bare patches in the field.',
        prevention: 'Avoid sunflower after long-term grass or pasture; monitor with bait stations.',
        treatment: 'Seed treatment where risk is known; there is no effective rescue treatment.'
      }
    ],
    tips: [
      'Never grow sunflower after sunflower — Sclerotinia and Phoma both carry over.',
      'Sow into warm soil; cold, wet seedbeds invite downy mildew and uneven emergence.',
      'Keep the head canopy open; dense stands hold humidity and favour head rot.'
    ]
  },
  {
    id: 'rapeseed',
    name: 'Rapeseed',
    family: 'Brassica · Brassicaceae',
    color: '#B5B548',
    rotation: 'At least 4 years between brassicas. Clubroot and Sclerotinia make short rotations expensive.',
    sowing: 'Winter rapeseed in late summer; spring rapeseed as early as possible. 35–50 plants/m² for winter types.',
    harvest: 'Summer, at 8–10% seed moisture. Swathing or direct harvest depends on the climate.',
    gdd: 'Base 5 °C · about 1300 °C·d to maturity',
    water: '350–600 mm; autumn establishment and flowering are the key windows.',
    diseases: [
      {
        name: 'Sclerotinia stem rot',
        pathogen: 'Sclerotinia sclerotiorum',
        symptoms: 'Pale, water-soaked stem lesions; white mycelium and black sclerotia inside the stem. Plants lodge or die prematurely.',
        prevention: 'Long rotation, avoid dense canopies, control broad-leaved weeds, do not over-fertilise nitrogen.',
        treatment: 'Fungicide at early to mid-flowering; coverage of the stem and leaf axils matters.'
      },
      {
        name: 'Clubroot',
        pathogen: 'Plasmodiophora brassicae',
        symptoms: 'Swollen, distorted roots; wilting in dry spells; stunted patches. The pathogen survives for many years.',
        prevention: 'Long break from brassicas, raise soil pH, improve drainage, control volunteer brassicas and cruciferous weeds.',
        treatment: 'No effective rescue treatment. Liming and rotation are the tools; avoid moving infected soil.'
      },
      {
        name: 'Phoma stem canker',
        pathogen: 'Leptosphaeria maculans',
        symptoms: 'Grey-brown lesions at the stem base in autumn; cankers girdle the stem by summer.',
        prevention: 'Resistant varieties, rotation, bury residue, sow when conditions favour rapid emergence.',
        treatment: 'Autumn fungicide at the leaf-spot stage; spring sprays are less reliable.'
      }
    ],
    pests: [
      {
        name: 'Flea beetles',
        symptoms: 'Small shot-holes in cotyledons and young leaves; seedlings can be killed in cold, slow-growing weather.',
        prevention: 'Sow into a warm, fast seedbed, use treated seed where permitted, monitor from emergence.',
        treatment: 'Insecticide only above threshold; repeated pyrethroid use drives resistance.'
      },
      {
        name: 'Pollen beetle',
        symptoms: 'Adults feed on buds and pollen; heavy numbers can reduce pod set.',
        prevention: 'Monitor at green bud and early flowering; avoid late sowing that concentrates flowering.',
        treatment: 'Spray at the local threshold, not by calendar. Protect bees — spray outside flowering hours.'
      }
    ],
    tips: [
      'Rapeseed is the best break crop for wheat — use that value, do not shorten the rotation.',
      'Autumn establishment decides the yield; a thin crop never catches up.',
      'Watch flowering for Sclerotinia and bees at the same time: timing is a compromise.'
    ]
  },
  {
    id: 'beet',
    name: 'Sugar beet',
    family: 'Amaranth · Amaranthaceae',
    color: '#B07990',
    rotation: '3–4 years between beet crops. Rhizoctonia and nematodes build up in short rotations.',
    sowing: 'Spring, when the soil at 5 cm is above 5–6 °C. 90,000–110,000 plants/ha for sugar beet.',
    harvest: 'Autumn, before hard frost. Sugar content rises late but root weight and frost risk trade off.',
    gdd: 'Base 3 °C · about 1800 °C·d to maturity',
    water: '400–650 mm; July–August water deficit is the main yield limit.',
    diseases: [
      {
        name: 'Cercospora leaf spot',
        pathogen: 'Cercospora beticola',
        symptoms: 'Small round spots with grey centres and dark red-brown margins; heavy infection kills older leaves.',
        prevention: 'Rotation, bury residue, resistant varieties, avoid excessive nitrogen.',
        treatment: 'Fungicide programme from first spots; rotate actives because resistance is common.'
      },
      {
        name: 'Rhizoctonia root rot',
        pathogen: 'Rhizoctonia solani',
        symptoms: 'Brown, sunken lesions at the root crown; plants wilt and roots rot. Worse in warm, wet soils.',
        prevention: 'Long rotation, good drainage, avoid deep cultivation that wounds roots, resistant varieties.',
        treatment: 'Fungicide at sowing or early post-emergence where labelled; rescue options are limited.'
      },
      {
        name: 'Powdery mildew',
        pathogen: 'Erysiphe betae',
        symptoms: 'White powdery coating on older leaves; late infection reduces sugar content.',
        prevention: 'Resistant varieties, balanced nitrogen, open canopies.',
        treatment: 'Sulphur or a labelled fungicide when mildew appears on the older leaves.'
      }
    ],
    pests: [
      {
        name: 'Black bean aphid',
        symptoms: 'Dense black colonies on young leaves and growing points; honeydew and virus risk.',
        prevention: 'Encourage natural enemies, avoid excess nitrogen, monitor from early summer.',
        treatment: 'Threshold-based aphicide; preserve predators and avoid pyrethroid overuse.'
      },
      {
        name: 'Beet flea beetle',
        symptoms: 'Small holes and window-paning on cotyledons; seedlings can be set back badly.',
        prevention: 'Fast early growth, seed treatment where permitted, monitor at emergence.',
        treatment: 'Foliar insecticide only above threshold; early sowing helps the crop outgrow damage.'
      }
    ],
    tips: [
      'Sugar beet is a deep-rooted crop: compaction costs more than a missed spray.',
      'Keep the rotation long — nematodes and Rhizoctonia are the long-term bill.',
      'Cercospora resistance is real; rotate fungicide modes of action.'
    ]
  },
  {
    id: 'potato',
    name: 'Potato',
    family: 'Nightshade · Solanaceae',
    color: '#9D8AB6',
    rotation: '3–4 years between potato crops. Late blight and nematodes make short rotations risky.',
    sowing: 'Plant certified seed when the soil is above 7–8 °C. 35,000–45,000 plants/ha depending on the market.',
    harvest: 'Summer to autumn, depending on maturity. Stop irrigation and let skins set before harvest.',
    gdd: 'Base 5 °C · about 1200 °C·d to maturity',
    water: '350–600 mm; tuber initiation and bulking are the critical windows.',
    diseases: [
      {
        name: 'Late blight',
        pathogen: 'Phytophthora infestans',
        symptoms: 'Water-soaked grey-green lesions on leaves with white sporulation on the underside in wet weather; stems and tubers rot.',
        prevention: 'Certified seed, long rotation, destroy cull piles and volunteers, avoid overhead irrigation in humid periods, use resistant varieties.',
        treatment: 'Protectant and systemic fungicides on a weather-driven schedule; rotate actives. Once the canopy is infected, control is limited.'
      },
      {
        name: 'Early blight',
        pathogen: 'Alternaria solani',
        symptoms: 'Concentric brown rings on older leaves; yellowing around the lesions. Usually appears after flowering.',
        prevention: 'Rotation, balanced nitrogen, avoid drought stress, remove infected residue.',
        treatment: 'Fungicide when lesions appear on the lower leaves; often mixed with late-blight programmes.'
      },
      {
        name: 'Rhizoctonia black scurf',
        pathogen: 'Rhizoctonia solani',
        symptoms: 'Black sclerotia on the tuber surface; stem cankers and uneven emergence.',
        prevention: 'Certified seed, rotation, avoid planting into cold wet soil, treat seed tubers.',
        treatment: 'Seed-tuber treatment at planting; there is no effective rescue spray.'
      }
    ],
    pests: [
      {
        name: 'Colorado potato beetle',
        symptoms: 'Adults and red larvae strip leaves; heavy defoliation cuts yield quickly.',
        prevention: 'Rotation, destroy volunteer potatoes, monitor from emergence, encourage natural enemies.',
        treatment: 'Insecticide at the local threshold; rotate actives because resistance is widespread.'
      },
      {
        name: 'Aphids',
        symptoms: 'Colonies on leaves and growing points; honeydew. The main risk is virus transmission.',
        prevention: 'Certified seed, monitor from emergence, avoid excess nitrogen.',
        treatment: 'Threshold-based aphicide; mineral oils can reduce virus spread.'
      }
    ],
    tips: [
      'Late blight is a weather problem, not a calendar problem — use a forecast-driven schedule.',
      'Certified seed is the cheapest disease insurance in potatoes.',
      'Do not plant potatoes after potatoes, tomatoes or other solanaceous crops.'
    ]
  },
  {
    id: 'pea',
    name: 'Pea',
    family: 'Legume · Fabaceae',
    color: '#6E9D76',
    rotation: 'A true break crop: fixes nitrogen and breaks cereal disease cycles. Return to peas after 4 years.',
    sowing: 'As early as the seedbed allows, when the soil is above 5 °C. 80–100 plants/m².',
    harvest: 'Early to mid-summer, at 14–16% grain moisture for combining peas.',
    gdd: 'Base 4 °C · about 1100 °C·d to maturity',
    water: '220–450 mm; flowering and pod fill are the critical windows.',
    diseases: [
      {
        name: 'Ascochyta blight',
        pathogen: 'Ascochyta pisi / Mycosphaerella pinodes',
        symptoms: 'Dark brown lesions on leaves, stems and pods; seeds may be discoloured.',
        prevention: 'Certified seed, long rotation, bury residue, avoid dense stands.',
        treatment: 'Seed treatment and a labelled foliar fungicide at early flowering where pressure is high.'
      },
      {
        name: 'Powdery mildew',
        pathogen: 'Erysiphe pisi',
        symptoms: 'White powdery coating on leaves and pods; late infection reduces seed fill.',
        prevention: 'Resistant varieties, avoid excessive nitrogen, open canopies.',
        treatment: 'Sulphur or a labelled fungicide when mildew appears.'
      },
      {
        name: 'Root rot complex',
        pathogen: 'Fusarium, Aphanomyces and Rhizoctonia species',
        symptoms: 'Brown roots, stunted plants, yellowing in patches; worse in compacted or waterlogged soil.',
        prevention: 'Long rotation, good drainage, avoid compaction, treat seed.',
        treatment: 'No reliable rescue treatment; drainage and rotation are the controls.'
      }
    ],
    pests: [
      {
        name: 'Pea aphid',
        symptoms: 'Green colonies on growing points and pods; honeydew. Virus risk in early growth.',
        prevention: 'Early sowing, natural enemies, avoid excess nitrogen.',
        treatment: 'Threshold-based aphicide; do not spray routinely.'
      },
      {
        name: 'Pea moth',
        symptoms: 'Larvae inside pods feeding on seeds; frass and webbing at the pod.',
        prevention: 'Monitor with pheromone traps at flowering, early sowing to escape the flight.',
        treatment: 'Insecticide at egg hatch, timed from trap catches; once larvae are inside, sprays fail.'
      }
    ],
    tips: [
      'Inoculate seed with the right Rhizobium if peas are new to the field.',
      'Peas leave nitrogen for the next crop — credit it in the rotation plan.',
      'Harvest early in the day to reduce pod splitting.'
    ]
  },
  {
    id: 'alfalfa',
    name: 'Alfalfa',
    family: 'Legume · Fabaceae',
    color: '#6B9E9C',
    rotation: 'A multi-year forage legume. Good before cereals; leave 3–4 years between stands to avoid autotoxicity and root disease.',
    sowing: 'Spring or late summer, into a firm, weed-free seedbed. 15–20 kg/ha.',
    harvest: 'First cut at bud to early flower, then every 30–40 days. Leave the last cut to build winter reserves.',
    gdd: 'Base 5 °C · about 1200 °C·d to first cut',
    water: '250–550 mm; established stands are deep-rooted but yield responds to irrigation.',
    diseases: [
      {
        name: 'Verticillium wilt',
        pathogen: 'Verticillium alfalfae',
        symptoms: 'Yellowing and wilting of upper leaves, often on one side of the plant; stems may die back.',
        prevention: 'Resistant varieties, clean seed, long rotation, avoid moving infected hay.',
        treatment: 'No effective rescue treatment; resistant varieties and stand renewal are the controls.'
      },
      {
        name: 'Anthracnose',
        pathogen: 'Colletotrichum trifolii',
        symptoms: 'Diamond-shaped dark lesions on stems; stems bend and break. Worse in warm, humid weather.',
        prevention: 'Resistant varieties, clean seed, avoid dense stands, rotate.',
        treatment: 'Fungicide is rarely economic; resistant varieties and harvest hygiene matter more.'
      },
      {
        name: 'Root rot',
        pathogen: 'Fusarium and Rhizoctonia species',
        symptoms: 'Brown, rotted roots; patches of stunted or dead plants, especially in wet soils.',
        prevention: 'Well-drained soil, avoid overgrazing, rotate before replanting.',
        treatment: 'No reliable rescue treatment; improve drainage and renew the stand.'
      }
    ],
    pests: [
      {
        name: 'Alfalfa weevil',
        symptoms: 'Larvae skeletonise leaves; heavy feeding on the first cut.',
        prevention: 'Early cutting, monitor from spring, encourage parasitoids.',
        treatment: 'Insecticide only above threshold; early harvest is often the best control.'
      },
      {
        name: 'Aphids',
        symptoms: 'Colonies on stems and leaves; honeydew and stunted growth.',
        prevention: 'Natural enemies, avoid excess nitrogen, monitor regrowth.',
        treatment: 'Threshold-based spray; preserve ladybirds and parasitoids.'
      }
    ],
    tips: [
      'Cut at the right stage — quality falls fast after early flower.',
      'Leave the last cut before frost to protect root reserves.',
      'Alfalfa fixes nitrogen but also dries the soil; plan the next crop accordingly.'
    ]
  }
];
