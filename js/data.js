/* UnderstandAI concept corpus - ported from data/concept_corpus.json */
window.UAI_CORPUS = {
  "concepts": [
    {
      "id": "percentages_proportions",
      "name": "Percentages & Proportions",
      "domain": "Arithmetic & Pre-Algebra",
      "summary": "Understanding percentages as relative parts of a reference base (hundredths), and recognizing that percentage changes always anchor to their starting value.",
      "keywords": [
        "percentage",
        "percent",
        "discount",
        "markup",
        "increase",
        "decrease",
        "profit",
        "loss",
        "sale",
        "original",
        "base",
        "ratio",
        "proportion",
        "rate",
        "fraction of",
        "off",
        "tax",
        "tip",
        "interest"
      ],
      "intuition": "Think of a percentage not as a static number, but as a scaling factor anchored to a specific reference point. 20% by itself is meaningless until you ask: '20% of what?' Whenever you calculate an increase or decrease, the denominator is ALWAYS the original starting value, never the newly changed amount.",
      "worked_example": {
        "problem": "A jacket originally priced at $80 is discounted by 25%. A week later, the store increases the sale price by 25%. What is the final price, and did it return to $80?",
        "step_by_step": [
          {
            "step": "Step 1: Calculate the discount",
            "reasoning": "Discount = 25% of the original $80 = 0.25 × 80 = $20.",
            "value": "Sale price = $80 - $20 = $60."
          },
          {
            "step": "Step 2: Identify the NEW reference base",
            "reasoning": "When the price increases by 25%, the base is no longer $80! The base is now the current price of $60.",
            "value": "Increase = 25% of $60 = 0.25 × 60 = $15."
          },
          {
            "step": "Step 3: Calculate the final price",
            "reasoning": "New Price = $60 + $15 = $75.",
            "value": "Final answer: $75. It did NOT return to $80 because 25% of a smaller number ($60) is less than 25% of the larger original ($80)."
          }
        ],
        "key_takeaway": "Percentage changes do not cancel out additively (+25% - 25% ≠ 0%) because each percentage operates on a different base value."
      },
      "misconceptions": [
        {
          "id": "inverse_cancellation_fallacy",
          "name": "Additive Percentage Fallacy",
          "trigger_patterns": [
            "cancels out",
            "remains the same",
            "back to original",
            "stays 80",
            "returns to initial",
            "zero change",
            "+25% -25%"
          ],
          "diagnosis": "You assumed that adding 25% and subtracting 25% cancel each other out. This is a common intuition trap! Because the second percentage is calculated on a different base amount, +X% followed by -X% always results in a net decrease.",
          "remediation_hint": "Always find the exact dollar amount of the intermediate value before applying the second percentage."
        },
        {
          "id": "base_value_inversion",
          "name": "Incorrect Base Value Assignment",
          "trigger_patterns": [
            "divided by final",
            "divided by new",
            "over 75",
            "over 60",
            "used new price"
          ],
          "diagnosis": "When calculating percentage change, you placed the new price in the denominator instead of the original starting price.",
          "remediation_hint": "Formula reminder: % Change = (Change / Original Starting Value) × 100%. Always divide by where you STARTED."
        },
        {
          "id": "additive_percentage_confusion",
          "name": "Treating Percentages as Raw Values",
          "trigger_patterns": [
            "subtracted 25",
            "added 25",
            "minus 25 dollars"
          ],
          "diagnosis": "You treated 25% as raw 25 dollars. 25% means 25 out of every 100, which must be multiplied by the base.",
          "remediation_hint": "Multiply the percentage as a decimal (0.25) by the price, rather than subtracting 25 directly."
        }
      ],
      "practice_challenges": [
        {
          "level": "fundamental",
          "question": "A digital tablet originally costs $200. During Black Friday, it is marked down by 20%. What is the sale price, and what was the dollar discount?",
          "expected_answer": "160",
          "expected_answer_display": "$160 (discount of $40)",
          "acceptable_numeric": [
            160,
            160.0
          ],
          "reasoning_checklist": [
            "20% of 200 is 40",
            "200 minus 40 is 160",
            "multiplied 200 by 0.8"
          ],
          "common_errors": {
            "180": "additive_percentage_confusion",
            "40": "answered discount amount instead of final sale price"
          }
        },
        {
          "level": "intermediate",
          "question": "An online course has 500 students. Next month enrollment drops by 10%. The following month it increases by 10% from that new level. How many students are enrolled now?",
          "expected_answer": "495",
          "expected_answer_display": "495 students",
          "acceptable_numeric": [
            495,
            495.0
          ],
          "reasoning_checklist": [
            "10% drop gives 450",
            "10% increase of 450 is 45",
            "450 + 45 = 495"
          ],
          "common_errors": {
            "500": "inverse_cancellation_fallacy",
            "450": "calculated only the first month drop"
          }
        },
        {
          "level": "advanced",
          "question": "After a 20% discount, a pair of running shoes sells for $72. What was the ORIGINAL price before the discount?",
          "expected_answer": "90",
          "expected_answer_display": "$90",
          "acceptable_numeric": [
            90,
            90.0
          ],
          "reasoning_checklist": [
            "$72 represents 80% of original",
            "72 / 0.8 = 90",
            "not 72 + 20% of 72"
          ],
          "common_errors": {
            "86.4": "base_value_inversion",
            "86.40": "base_value_inversion",
            "92": "additive_percentage_confusion"
          }
        }
      ]
    },
    {
      "id": "linear_equations",
      "name": "Linear Equations & Variable Balancing",
      "domain": "Algebra",
      "summary": "Mastering the preservation of equality through inverse operations and treating algebraic equations as balanced scales.",
      "keywords": [
        "equation",
        "solve for x",
        "variable",
        "linear",
        "isolate",
        "coefficient",
        "constant",
        "both sides",
        "inverse operation",
        "like terms",
        "balance",
        "substitute",
        "simplify",
        "parentheses",
        "distribute"
      ],
      "intuition": "An algebraic equation is like a balanced seesaw. Whatever operation you apply to one side to peel away numbers from 'x', you must identically apply to the other side to keep the seesaw in equilibrium. Work backwards through operations: undo additions/subtractions first, then undo multiplications/divisions.",
      "worked_example": {
        "problem": "Solve for x: 3(x - 4) + 5 = 20",
        "step_by_step": [
          {
            "step": "Step 1: Expand or isolate the grouped term",
            "reasoning": "First, subtract 5 from both sides to peel off the outer constant.",
            "value": "3(x - 4) = 15"
          },
          {
            "step": "Step 2: Undo the multiplication",
            "reasoning": "Divide both sides by 3 rather than unnecessarily expanding.",
            "value": "x - 4 = 5"
          },
          {
            "step": "Step 3: Undo the subtraction",
            "reasoning": "Add 4 to both sides to isolate x completely.",
            "value": "x = 9. Verification: 3(9 - 4) + 5 = 3(5) + 5 = 20 (Balanced!)."
          }
        ],
        "key_takeaway": "Peel terms like layers of an onion: start from the outermost terms furthest from x."
      },
      "misconceptions": [
        {
          "id": "sign_inversion_error",
          "name": "Sign Inversion Failure",
          "trigger_patterns": [
            "moved term didn't flip sign",
            "kept minus",
            "-3x = 12 became x = 4",
            "sign flip mistake"
          ],
          "diagnosis": "When moving a term across the equals sign or dividing by a negative number, the sign was incorrectly handled.",
          "remediation_hint": "Remember: moving a term across '=' is actually performing an inverse operation. +4 becomes -4 on the opposite side."
        },
        {
          "id": "combining_unlike_terms",
          "name": "Combining Unlike Terms",
          "trigger_patterns": [
            "added 3x and 5 to get 8x",
            "combined x and constant",
            "8x"
          ],
          "diagnosis": "You combined a variable term with a pure constant number (like treating 3 apples + 5 dollars as 8 apple-dollars).",
          "remediation_hint": "Only terms that share the exact same variable parts can be added or subtracted together."
        }
      ],
      "practice_challenges": [
        {
          "level": "fundamental",
          "question": "Solve for x: 4x - 7 = 21",
          "expected_answer": "7",
          "expected_answer_display": "x = 7",
          "acceptable_numeric": [
            7,
            7.0
          ],
          "reasoning_checklist": [
            "add 7 to both sides to get 28",
            "divide 28 by 4 to get 7"
          ],
          "common_errors": {
            "3.5": "subtracted 7 instead of adding (21 - 7 = 14, 14/4 = 3.5)",
            "14": "sign_inversion_error"
          }
        },
        {
          "level": "intermediate",
          "question": "Solve for x: 2(3x + 1) - 4 = 16",
          "expected_answer": "3",
          "expected_answer_display": "x = 3",
          "acceptable_numeric": [
            3,
            3.0
          ],
          "reasoning_checklist": [
            "add 4 to both sides to get 20",
            "divide by 2 gives 3x + 1 = 10",
            "subtract 1 gives 3x = 9",
            "divide by 3 gives 3"
          ],
          "common_errors": {
            "2": "sign or distribution slip",
            "1.8": "combining_unlike_terms"
          }
        }
      ]
    },
    {
      "id": "quadratic_equations",
      "name": "Quadratic Equations & Roots",
      "domain": "Algebra & Functions",
      "summary": "Understanding non-linear polynomial relationships, parabolic symmetry, factoring, and the Zero Product Property.",
      "keywords": [
        "quadratic",
        "parabola",
        "roots",
        "factoring",
        "zeros",
        "discriminant",
        "square root",
        "x squared",
        "polynomial",
        "vertex",
        "quadratic formula"
      ],
      "intuition": "Unlike linear equations with a single straight path, quadratic equations describe curved parabolas that often intersect zero at TWO distinct points. Crucially, if A × B = 0, then at least one factor MUST be zero (Zero Product Property). If the equation does not equal zero, you cannot solve by factoring directly!",
      "worked_example": {
        "problem": "Solve for x: x² - 5x + 6 = 0",
        "step_by_step": [
          {
            "step": "Step 1: Check standard form (ax² + bx + c = 0)",
            "reasoning": "The equation is already set equal to 0, which unlocks the Zero Product Property.",
            "value": "a = 1, b = -5, c = 6"
          },
          {
            "step": "Step 2: Find two numbers that multiply to +6 and add to -5",
            "reasoning": "-2 × -3 = +6, and -2 + -3 = -5.",
            "value": "(x - 2)(x - 3) = 0"
          },
          {
            "step": "Step 3: Solve each linear branch",
            "reasoning": "Either x - 2 = 0 or x - 3 = 0.",
            "value": "x = 2 or x = 3."
          }
        ],
        "key_takeaway": "Always drive quadratic equations to 0 before factoring. Factoring when the right side is non-zero leads to invalid solutions."
      },
      "misconceptions": [
        {
          "id": "missing_negative_root",
          "name": "Single Root Omission",
          "trigger_patterns": [
            "only positive root",
            "only x=5",
            "forgot plus minus",
            "omitted negative"
          ],
          "diagnosis": "When taking the square root of both sides (e.g. x² = 25), you only kept the positive root x = 5, forgetting that (-5)² is also 25.",
          "remediation_hint": "Remember that √k produces both +√k and -√k in equations."
        },
        {
          "id": "non_zero_factoring",
          "name": "Non-Zero Product Fallacy",
          "trigger_patterns": [
            "factored before zero",
            "set factors to 6",
            "multiplied without setting 0"
          ],
          "diagnosis": "You factored the expression before making the right side equal to zero.",
          "remediation_hint": "The Zero Product Property ONLY works for 0! There is no 'Six Product Property'."
        }
      ],
      "practice_challenges": [
        {
          "level": "intermediate",
          "question": "Solve for x: x² - 7x + 12 = 0. Enter the larger root.",
          "expected_answer": "4",
          "expected_answer_display": "x = 4 (roots are 3 and 4)",
          "acceptable_numeric": [
            4,
            4.0
          ],
          "reasoning_checklist": [
            "factored into (x - 3)(x - 4) = 0",
            "roots are 3 and 4",
            "larger root is 4"
          ],
          "common_errors": {
            "3": "entered the smaller root instead of the larger root",
            "-4": "sign_inversion_error"
          }
        }
      ]
    },
    {
      "id": "fractions_rationals",
      "name": "Fractions & Rational Operations",
      "domain": "Arithmetic & Number Theory",
      "summary": "Mastering the logic of fractional parts, common denominators, and reciprocal multiplication.",
      "keywords": [
        "fraction",
        "numerator",
        "denominator",
        "simplify",
        "reciprocal",
        "common denominator",
        "rational",
        "divide fractions",
        "mixed number"
      ],
      "intuition": "The denominator tells you the 'size of the slice', and the numerator tells you 'how many slices you have'. You cannot directly add 1/3 and 1/4 because you are adding slices of completely different sizes! You must first cut them into slices of equal size (common denominator).",
      "worked_example": {
        "problem": "Evaluate: 2/3 ÷ 4/5",
        "step_by_step": [
          {
            "step": "Step 1: Understand division by a fraction",
            "reasoning": "Dividing by 4/5 asks: 'How many 4/5-sized portions fit into 2/3?' This is mathematically identical to multiplying by its reciprocal 5/4.",
            "value": "2/3 ÷ 4/5 = 2/3 × 5/4"
          },
          {
            "step": "Step 2: Multiply straight across",
            "reasoning": "Numerator: 2 × 5 = 10. Denominator: 3 × 4 = 12.",
            "value": "10/12"
          },
          {
            "step": "Step 3: Simplify to lowest terms",
            "reasoning": "Divide top and bottom by greatest common divisor 2.",
            "value": "5/6 (or ~0.833)."
          }
        ],
        "key_takeaway": "Never divide fractions directly; invert the divisor and multiply ('Keep, Change, Flip')."
      },
      "misconceptions": [
        {
          "id": "straight_across_addition",
          "name": "Direct Numerator/Denominator Addition",
          "trigger_patterns": [
            "added tops and bottoms",
            "1/2 + 1/3 = 2/5",
            "direct addition"
          ],
          "diagnosis": "You added numerators together and denominators together across different denominators.",
          "remediation_hint": "Denominators must match before adding. Find the least common multiple first."
        }
      ],
      "practice_challenges": [
        {
          "level": "fundamental",
          "question": "What is 3/4 + 1/6 expressed as a simplified fraction numerator over denominator (e.g. 11/12)?",
          "expected_answer": "11/12",
          "expected_answer_display": "11/12",
          "acceptable_numeric": [
            0.9167,
            0.917
          ],
          "reasoning_checklist": [
            "common denominator is 12",
            "3/4 = 9/12",
            "1/6 = 2/12",
            "9/12 + 2/12 = 11/12"
          ],
          "common_errors": {
            "4/10": "straight_across_addition",
            "2/5": "straight_across_addition"
          }
        }
      ]
    },
    {
      "id": "physics_kinematics",
      "name": "Kinematics & Motion Dynamics",
      "domain": "Physics",
      "summary": "Understanding motion descriptors (displacement, velocity, acceleration) and disentangling rate of change from momentary values.",
      "keywords": [
        "physics",
        "kinematics",
        "velocity",
        "acceleration",
        "speed",
        "displacement",
        "gravity",
        "free fall",
        "projectile",
        "motion",
        "newton",
        "force"
      ],
      "intuition": "Velocity is where you are heading right now; acceleration is how violently that heading is being changed. A car stopped at a red light that slams the gas has zero velocity but high acceleration. A stone thrown straight up has zero velocity for an instant at its peak, but gravity's acceleration is still pulling downward at 9.8 m/s²!",
      "worked_example": {
        "problem": "A ball is thrown straight up at 20 m/s. Assuming g = 10 m/s², what is its velocity and acceleration at the highest point of its flight?",
        "step_by_step": [
          {
            "step": "Step 1: Analyze velocity at peak",
            "reasoning": "As the ball climbs, gravity slows it down. At the exact inflection point before falling back, upward motion ceases.",
            "value": "Instantaneous Velocity = 0 m/s."
          },
          {
            "step": "Step 2: Analyze acceleration at peak",
            "reasoning": "Gravity does not take a vacation! The Earth is still pulling on the mass with constant force F = mg.",
            "value": "Acceleration = -10 m/s² (downward)."
          }
        ],
        "key_takeaway": "Zero velocity does NOT mean zero acceleration. Acceleration is the rate of change of velocity, not the velocity itself."
      },
      "misconceptions": [
        {
          "id": "zero_velocity_zero_accel",
          "name": "Acceleration-Velocity Conflation",
          "trigger_patterns": [
            "acceleration is 0 at top",
            "zero acceleration at peak",
            "both zero"
          ],
          "diagnosis": "You assumed that because the object momentarily stopped moving (v = 0), acceleration must also be 0.",
          "remediation_hint": "If acceleration were 0 at the peak, the ball would hover suspended in midair forever!"
        }
      ],
      "practice_challenges": [
        {
          "level": "fundamental",
          "question": "A vehicle accelerates uniformly from rest (0 m/s) to 30 m/s in 6 seconds. What is its acceleration in m/s²?",
          "expected_answer": "5",
          "expected_answer_display": "5 m/s²",
          "acceptable_numeric": [
            5,
            5.0
          ],
          "reasoning_checklist": [
            "a = (v_final - v_initial) / t",
            "(30 - 0) / 6 = 5"
          ],
          "common_errors": {
            "180": "multiplied speed by time instead of dividing",
            "0.2": "inverted the division"
          }
        }
      ]
    }
  ]
};
