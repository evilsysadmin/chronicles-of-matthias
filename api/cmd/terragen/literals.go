package main

// Hand-authored quest blocks kept verbatim as JSON (key order matters).

const b4TaxQuestJSON = `[
  {
    "id": "b4-farmer",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "key": "b4TaxLeadStarted",
        "falsy": true
      }
    ],
    "label": "Preguntar a Tesa por los impuestos de los ausentes",
    "action": {
      "effects": [
        {
          "type": "set",
          "key": "b4TaxLeadStarted",
          "value": true
        },
        {
          "type": "start-quest",
          "questId": "tax-of-the-forgotten",
          "title": "El impuesto de los ausentes",
          "description": "En B4 cobran tributos incluso a vecinos cuyo recuerdo se ha borrado. El carbonero Bruno transportó las cuentas selladas.",
          "objective": "Busca a Bruno en el Bosque Ceniciento (E4) y recupera el libro de tasas.",
          "order": 40
        }
      ],
      "message": "Tesa se aferra al delantal: «Aún nos cobran por doce vecinos que nadie recuerda. Bruno llevaba sus nombres anotados. Encuéntralo en el Bosque Ceniciento, E4».",
      "journal": {
        "id": "b4-tax-whispers",
        "title": "Doce nombres ausentes",
        "body": "La cuenta real exige tributos a personas que nadie recuerda. Bruno, en E4, vio el libro.",
        "sigil": "◆"
      }
    }
  },
  {
    "id": "b4-farmer-proof",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "questId": "tax-of-the-forgotten",
        "questStatus": "active"
      }
    ],
    "label": "Entregar a Tesa el libro de tasas",
    "lockedLabel": "Tesa espera el libro de Bruno",
    "requirements": [
      {
        "itemId": "forgotten-tax-ledger",
        "quantity": 1,
        "message": "Bruno guarda las cuentas en el Bosque Ceniciento (E4)."
      }
    ],
    "action": {
      "effects": [
        {
          "type": "claim-reward",
          "rewardId": "terra:b4:tax-absent:v1",
          "requirements": [
            {
              "questId": "tax-of-the-forgotten",
              "questStatus": "active"
            },
            {
              "itemId": "forgotten-tax-ledger",
              "quantity": 1
            }
          ],
          "effects": [
            {
              "type": "consume-item",
              "itemId": "forgotten-tax-ledger",
              "quantity": 1
            },
            {
              "type": "complete-quest",
              "questId": "tax-of-the-forgotten",
              "objective": "Tesa conserva la prueba de los nombres borrados."
            },
            {
              "type": "grant-gold",
              "amount": 22
            },
            {
              "type": "award-xp",
              "awardId": "terra:b4:tax-absent:xp:v1",
              "amount": 40
            }
          ]
        }
      ],
      "message": "Tesa reconoce un nombre en el libro y se le rompe la voz: «Mi hermano. Decían que nunca existió». Conserva la prueba contra el Canciller y entrega 22 monedas a la compañía.",
      "journal": {
        "id": "b4-taxes-restored",
        "title": "Los que no fueron olvidados",
        "body": "El libro demuestra que el Canciller sigue cobrando a quienes el Silencio ha borrado. Tesa custodia sus nombres.",
        "sigil": "◆"
      }
    }
  },
  {
    "id": "b4-farmer-after",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "questId": "tax-of-the-forgotten",
        "questStatus": "completed"
      }
    ],
    "label": "Volver a hablar con Tesa",
    "action": {
      "effects": [],
      "message": "Tesa mantiene el libro envuelto bajo su camisa: «Ahora que recuerdo su nombre, no permitiré que lo borren otra vez»."
    }
  }
]`

const e4TaxQuestJSON = `[
  {
    "id": "e4-charcoal",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "key": "b4TaxLeadStarted",
        "falsy": true
      }
    ],
    "label": "Hablar con el carbonero Bruno",
    "action": {
      "effects": [],
      "message": "El carbonero Bruno: «En las Minas de Escoria trabajan de noche. ¿Quién trabaja de noche en una mina?»"
    }
  },
  {
    "id": "e4-bruno-ledger",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "key": "b4TaxLeadStarted",
        "truthy": true
      },
      {
        "key": "e4LedgerRecovered",
        "falsy": true
      }
    ],
    "label": "Preguntar a Bruno por el libro de tasas",
    "action": {
      "effects": [
        {
          "type": "set",
          "key": "e4LedgerRecovered",
          "value": true
        },
        {
          "type": "grant-item",
          "itemId": "forgotten-tax-ledger",
          "name": "Libro de los tributos olvidados",
          "description": "Doce nombres borrados siguen tributando bajo el sello del Canciller Varren.",
          "quantity": 1
        },
        {
          "type": "advance-quest",
          "questId": "tax-of-the-forgotten",
          "objective": "Devuelve a Tesa el libro de tasas en Granjas del Trigo (B4)."
        }
      ],
      "message": "Bruno extrae de la carbonera un libro chamuscado. Doce nombres desaparecidos siguen tributando. La orden lleva el sello de Varren: no eran deudas, eran personas que alguien quiso borrar.",
      "journal": {
        "id": "e4-accounts-found",
        "title": "El libro chamuscado",
        "body": "La cancillería aún recauda sobre los ausentes. La prueba debe regresar a Tesa (B4).",
        "sigil": "◆"
      }
    }
  },
  {
    "id": "e4-bruno-after",
    "kind": "lore",
    "visualType": "rookwood-mourner",
    "x": 5,
    "y": 4,
    "when": [
      {
        "key": "e4LedgerRecovered",
        "truthy": true
      }
    ],
    "label": "Volver a hablar con Bruno",
    "action": {
      "effects": [],
      "message": "Bruno señala al oeste: «Lleva esas cuentas a Tesa, en B4. Yo seguiré quemando carbón. El que quiera quemar nombres ya tendrá bastante trabajo»."
    }
  }
]`

const f1LighthouseJSON = `[
  {
    "id": "f1-keepers-log",
    "kind": "lore",
    "visualType": "signpost",
    "x": 15,
    "y": 4,
    "persistentVisual": true,
    "label": "Leer la bitácora del último farero",
    "action": {
      "effects": [
        {
          "type": "set",
          "key": "f1BeaconLogRead",
          "value": true
        }
      ],
      "message": "La última entrada dice: «No alumbres las casas. Los barcos perdidos buscan mar abierto. La lente duerme junto al casco varado, al suroeste. No dejes que el Silencio decida por ti».",
      "journal": {
        "id": "f1-keeper-log",
        "title": "La luz que aún debe volver",
        "body": "El farero escondió la lente cerca del naufragio, al suroeste del Faro Helado (F1). El espejo debe mirar a mar abierto.",
        "sigil": "✦"
      }
    }
  },
  {
    "id": "f1-frosted-lens",
    "kind": "pickup",
    "visualType": "chest",
    "x": 5,
    "y": 10,
    "when": [
      {
        "key": "f1FrostLensRecovered",
        "falsy": true
      }
    ],
    "label": "Recuperar la lente del casco helado",
    "action": {
      "effects": [
        {
          "type": "set",
          "key": "f1FrostLensRecovered",
          "value": true
        },
        {
          "type": "grant-item",
          "itemId": "f1-frosted-lens",
          "name": "Lente escarchada del farero",
          "description": "Vidrio azulado de la linterna del Faro Helado. Encaja en los engranajes de F1.",
          "quantity": 1
        }
      ],
      "message": "Bajo las tablas de un barco encallado encuentras una lente intacta. En el borde alguien grabó doce nombres que el mar no consiguió borrar."
    }
  },
  {
    "id": "f1-mirror-gear",
    "kind": "lore",
    "visualType": "shrine",
    "x": 15,
    "y": 10,
    "when": [
      {
        "key": "f1OpticAligned",
        "falsy": true
      }
    ],
    "label": "Montar la lente y orientar el espejo al mar",
    "lockedLabel": "El espejo no tiene lente",
    "requirements": [
      {
        "itemId": "f1-frosted-lens",
        "quantity": 1,
        "message": "Falta la lente que el farero escondió en el naufragio, al suroeste."
      }
    ],
    "action": {
      "effects": [
        {
          "type": "consume-item",
          "itemId": "f1-frosted-lens",
          "quantity": 1
        },
        {
          "type": "set",
          "key": "f1OpticAligned",
          "value": true
        }
      ],
      "message": "Montas la lente en el espejo y sigues las instrucciones de la bitácora: el cristal apunta a mar abierto. El mecanismo vuelve a respirar.",
      "journal": {
        "id": "f1-optic-aligned",
        "title": "El mar espera una señal",
        "body": "La lente vuelve a su sitio; la linterna del faro está lista. Falta decidir qué hacer con la última luz.",
        "sigil": "✦"
      }
    }
  },
  {
    "id": "f1-mirror-force",
    "kind": "lore",
    "visualType": "shrine",
    "x": 10,
    "y": 10,
    "when": [
      {
        "key": "f1OpticAligned",
        "falsy": true
      },
      {
        "key": "f1MirrorScorched",
        "falsy": true
      }
    ],
    "label": "Forzar el mecanismo hacia las casas",
    "requirements": [
      {
        "itemId": "f1-frosted-lens",
        "quantity": 1,
        "message": "Sin la lente, el engranaje está inmóvil."
      }
    ],
    "action": {
      "effects": [
        {
          "type": "set",
          "key": "f1MirrorScorched",
          "value": true
        },
        {
          "type": "damage-party",
          "amount": 3
        }
      ],
      "message": "Fuerzas la manivela hacia tierra. El vidrio devuelve un destello helado: la compañía recibe daño. La bitácora avisaba de que el faro no busca las casas."
    }
  },
  {
    "id": "f1-beacon-before",
    "kind": "lore",
    "visualType": "rookwood-mourner-voice",
    "x": 16,
    "y": 7,
    "label": "Examinar la linterna del faro",
    "action": {
      "effects": [],
      "message": "Las juntas del faro sostienen un voto antiguo: «A quien no recuerden, una luz. A quien aún espere, un camino». Aquí se decide el destino de la linterna."
    },
    "when": [
      {
        "key": "f1OpticAligned",
        "falsy": true
      }
    ]
  },
  {
    "id": "f1-beacon-rescue",
    "kind": "lore",
    "visualType": "frozen-beacon",
    "x": 16,
    "y": 7,
    "when": [
      {
        "key": "f1OpticAligned",
        "truthy": true
      },
      {
        "key": "f1BeaconResolved",
        "falsy": true
      }
    ],
    "label": "Devolver la luz a los navegantes olvidados",
    "lockedLabel": "Aún falta orientar el espejo",
    "requirements": [
      {
        "key": "f1OpticAligned",
        "truthy": true,
        "message": "Debes recuperar la lente y orientar el espejo hacia mar abierto."
      }
    ],
    "action": {
      "effects": [
        {
          "type": "claim-reward",
          "rewardId": "terra:f1:beacon:v1",
          "requirements": [
            {
              "key": "f1BeaconResolved",
              "falsy": true
            },
            {
              "key": "f1OpticAligned",
              "truthy": true
            }
          ],
          "effects": [
            {
              "type": "set",
              "key": "f1BeaconResolved",
              "value": true
            },
            {
              "type": "set",
              "key": "f1BeaconChoice",
              "value": "rescue"
            },
            {
              "type": "grant-item",
              "itemId": "silver-staff",
              "name": "Bastón de plata",
              "description": "Un bastón real, templado por los últimos reflejos del Faro Helado.",
              "quantity": 1
            },
            {
              "type": "award-xp",
              "awardId": "terra:f1:beacon:rescued:v1",
              "amount": 35
            }
          ]
        }
      ],
      "message": "La linterna rompe la niebla. Durante un instante, una hilera de velas invisibles responde desde el mar. Entre los útiles del farero queda un bastón de plata para la compañía.",
      "journal": {
        "id": "f1-beacon-lit",
        "title": "Una luz para los que faltan",
        "body": "La linterna guía a los barcos que nadie recuerda. La compañía renunció a vender el espejo y recuperó un bastón de plata.",
        "sigil": "✦"
      }
    },
    "persistentVisual": true,
    "visualActivatedWhen": [
      {
        "key": "f1BeaconChoice",
        "equals": "rescue"
      }
    ]
  },
  {
    "id": "f1-beacon-salvage",
    "kind": "lore",
    "visualType": "signpost",
    "x": 4,
    "y": 7,
    "when": [
      {
        "key": "f1BeaconResolved",
        "falsy": true
      }
    ],
    "label": "Desmontar el espejo y vender su plata",
    "lockedLabel": "La lente aún no está en su sitio",
    "requirements": [
      {
        "key": "f1OpticAligned",
        "truthy": true,
        "message": "La linterna sigue inservible sin la lente."
      }
    ],
    "action": {
      "effects": [
        {
          "type": "claim-reward",
          "rewardId": "terra:f1:beacon:v1",
          "requirements": [
            {
              "key": "f1BeaconResolved",
              "falsy": true
            },
            {
              "key": "f1OpticAligned",
              "truthy": true
            }
          ],
          "effects": [
            {
              "type": "set",
              "key": "f1BeaconResolved",
              "value": true
            },
            {
              "type": "set",
              "key": "f1BeaconChoice",
              "value": "salvage"
            },
            {
              "type": "grant-gold",
              "amount": 75
            },
            {
              "type": "award-xp",
              "awardId": "terra:f1:beacon:salvaged:v1",
              "amount": 10
            }
          ]
        }
      ],
      "message": "El faro se queda oscuro. Vendes las piezas de plata por 75 monedas; la niebla se traga, una a una, las luces que creíste ver mar adentro.",
      "journal": {
        "id": "f1-beacon-stripped",
        "title": "El precio de una luz",
        "body": "La compañía desmontó el espejo y cobró su valor. Ya nadie responderá a la linterna del Faro Helado.",
        "sigil": "✦"
      }
    },
    "persistentVisual": true
  },
  {
    "id": "f1-beacon-rescued-after",
    "kind": "lore",
    "visualType": "rookwood-mourner-voice",
    "x": 16,
    "y": 7,
    "when": [
      {
        "key": "f1BeaconChoice",
        "equals": "rescue"
      }
    ],
    "label": "Observar el faro encendido",
    "action": {
      "effects": [],
      "message": "Al norte, luces de barcos sin nombre contestan al faro. Ninguna se acerca a costa; al menos ahora saben volver."
    }
  },
  {
    "id": "f1-beacon-salvaged-after",
    "kind": "lore",
    "visualType": "rookwood-mourner-voice",
    "x": 16,
    "y": 7,
    "when": [
      {
        "key": "f1BeaconChoice",
        "equals": "salvage"
      }
    ],
    "label": "Examinar la linterna desmantelada",
    "action": {
      "effects": [],
      "message": "Las tuercas vacías están frías. El mar calla: la plata ya no puede comprar aquella última luz."
    }
  }
]`

