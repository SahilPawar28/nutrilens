/**
 * Centralized food icon utility.
 * Maps food names (from AI analysis) → emoji + gradient background.
 * Mirrors the nourish-ai FoodTypeIcon category system.
 */

export interface FoodIconInfo {
  emoji: string;
  gradient: [string, string];
  category: string;
}

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES: Record<string, FoodIconInfo> = {
  Seafood:       { emoji: '🐟', gradient: ['#C8F0F8', '#A0E0F0'], category: 'Seafood' },
  Meat:          { emoji: '🥩', gradient: ['#FDDEDE', '#FAC8C8'], category: 'Meat' },
  Chicken:       { emoji: '🍗', gradient: ['#FDEAC8', '#FAD8A0'], category: 'Chicken' },
  Eggs:          { emoji: '🥚', gradient: ['#FFF9C4', '#FFF176'], category: 'Eggs' },
  Rice:          { emoji: '🍚', gradient: ['#F5F5F0', '#E8E8E0'], category: 'Rice Dishes' },
  Curry:         { emoji: '🍛', gradient: ['#FEE8C8', '#FDD090'], category: 'Curries' },
  Bread:         { emoji: '🍞', gradient: ['#FDEAC8', '#F8D59A'], category: 'Bread' },
  Flatbread:     { emoji: '🫓', gradient: ['#FEF3C0', '#FDE68A'], category: 'Flatbread' },
  Salad:         { emoji: '🥗', gradient: ['#D4EDDA', '#B2DFDB'], category: 'Salads' },
  Vegetables:    { emoji: '🥦', gradient: ['#C8E6C9', '#A5D6A7'], category: 'Vegetables' },
  Fruits:        { emoji: '🍎', gradient: ['#FFCDD2', '#F48FB1'], category: 'Fruits' },
  Soup:          { emoji: '🍲', gradient: ['#FFE0B2', '#FFCC80'], category: 'Soups' },
  Noodles:       { emoji: '🍜', gradient: ['#FFF8E1', '#FFECB3'], category: 'Noodles' },
  Pasta:         { emoji: '🍝', gradient: ['#FFF3E0', '#FFE082'], category: 'Pasta' },
  Sushi:         { emoji: '🍱', gradient: ['#E3F2FD', '#BBDEFB'], category: 'Sushi' },
  Pizza:         { emoji: '🍕', gradient: ['#FFF8E1', '#FFE082'], category: 'Pizza' },
  Burger:        { emoji: '🍔', gradient: ['#FFF3E0', '#FFCC80'], category: 'Fast Food' },
  Sandwich:      { emoji: '🥪', gradient: ['#FFF8E1', '#FFF176'], category: 'Sandwich' },
  Snack:         { emoji: '🍿', gradient: ['#EDE7F6', '#D1C4E9'], category: 'Snacks' },
  Dessert:       { emoji: '🧁', gradient: ['#FCE4EC', '#F8BBD9'], category: 'Desserts' },
  Beverage:      { emoji: '🥤', gradient: ['#E0F7FA', '#B2EBF2'], category: 'Beverages' },
  Coffee:        { emoji: '☕', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Coffee' },
  Smoothie:      { emoji: '🥤', gradient: ['#E8F5E9', '#C8E6C9'], category: 'Smoothie' },
  Juice:         { emoji: '🍹', gradient: ['#FFF9C4', '#F9A825'], category: 'Juice' },
  Milk:          { emoji: '🥛', gradient: ['#F5F5F5', '#E0E0E0'], category: 'Dairy' },
  Cheese:        { emoji: '🧀', gradient: ['#FFF9C4', '#FFF176'], category: 'Dairy' },
  Yogurt:        { emoji: '🫙', gradient: ['#E8F5E9', '#C8E6C9'], category: 'Dairy' },
  Avocado:       { emoji: '🥑', gradient: ['#DCEDC8', '#C5E1A5'], category: 'Healthy' },
  Wrap:          { emoji: '🌯', gradient: ['#FFF3E0', '#FFE0B2'], category: 'Wrap' },
  Taco:          { emoji: '🌮', gradient: ['#FFF8E1', '#FFECB3'], category: 'Street Food' },
  Pancake:       { emoji: '🥞', gradient: ['#FFF9C4', '#FFF176'], category: 'Breakfast' },
  Waffle:        { emoji: '🧇', gradient: ['#FFF8E1', '#FFE082'], category: 'Breakfast' },
  Oats:          { emoji: '🥣', gradient: ['#EFEBE9', '#BCAAA4'], category: 'Breakfast' },
  Cereal:        { emoji: '🥣', gradient: ['#FFF3E0', '#FFCC80'], category: 'Breakfast' },
  Dal:           { emoji: '🫘', gradient: ['#FFF8E1', '#F9A825'], category: 'Legumes' },
  Beans:         { emoji: '🫘', gradient: ['#EFEBE9', '#BCAAA4'], category: 'Legumes' },
  Lentils:       { emoji: '🫘', gradient: ['#FFF3E0', '#FFCC80'], category: 'Legumes' },
  Tofu:          { emoji: '🌱', gradient: ['#E8F5E9', '#A5D6A7'], category: 'Plant Protein' },
  Mushroom:      { emoji: '🍄', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Vegetables' },
  Corn:          { emoji: '🌽', gradient: ['#FFFDE7', '#FFF176'], category: 'Vegetables' },
  Potato:        { emoji: '🥔', gradient: ['#FFF9C4', '#F5F5DC'], category: 'Vegetables' },
  Tomato:        { emoji: '🍅', gradient: ['#FFCDD2', '#EF9A9A'], category: 'Vegetables' },
  Carrot:        { emoji: '🥕', gradient: ['#FFF3E0', '#FFCC80'], category: 'Vegetables' },
  Broccoli:      { emoji: '🥦', gradient: ['#C8E6C9', '#A5D6A7'], category: 'Vegetables' },
  Spinach:       { emoji: '🥬', gradient: ['#C8E6C9', '#81C784'], category: 'Vegetables' },
  Apple:         { emoji: '🍎', gradient: ['#FFCDD2', '#EF9A9A'], category: 'Fruits' },
  Banana:        { emoji: '🍌', gradient: ['#FFFDE7', '#FFF176'], category: 'Fruits' },
  Mango:         { emoji: '🥭', gradient: ['#FFE0B2', '#FFCC80'], category: 'Fruits' },
  Orange:        { emoji: '🍊', gradient: ['#FFE0B2', '#FFB74D'], category: 'Fruits' },
  Grapes:        { emoji: '🍇', gradient: ['#EDE7F6', '#CE93D8'], category: 'Fruits' },
  Strawberry:    { emoji: '🍓', gradient: ['#FFCDD2', '#F48FB1'], category: 'Fruits' },
  Watermelon:    { emoji: '🍉', gradient: ['#C8E6C9', '#FFCDD2'], category: 'Fruits' },
  Pineapple:     { emoji: '🍍', gradient: ['#FFFDE7', '#FFD54F'], category: 'Fruits' },
  Steak:         { emoji: '🥩', gradient: ['#FDDEDE', '#EF9A9A'], category: 'Meat' },
  Lamb:          { emoji: '🍖', gradient: ['#FDDEDE', '#FAC8C8'], category: 'Meat' },
  Pork:          { emoji: '🍖', gradient: ['#FDDEDE', '#FAC8C8'], category: 'Meat' },
  Biryani:       { emoji: '🍛', gradient: ['#FEE8C8', '#FFD090'], category: 'Curries' },
  Dosa:          { emoji: '🫓', gradient: ['#FEF3C0', '#FDE68A'], category: 'Flatbread' },
  Idli:          { emoji: '🫓', gradient: ['#F5F5F0', '#E8E8E0'], category: 'Breakfast' },
  Samosa:        { emoji: '🔺', gradient: ['#FFF3E0', '#FFCC80'], category: 'Street Food' },
  Pakora:        { emoji: '🔺', gradient: ['#FFF3E0', '#FFD54F'], category: 'Snacks' },
  Chaat:         { emoji: '🍿', gradient: ['#FFF8E1', '#FFE082'], category: 'Street Food' },
  Paratha:       { emoji: '🫓', gradient: ['#FEF3C0', '#FDD835'], category: 'Flatbread' },
  Naan:          { emoji: '🫓', gradient: ['#FEF3C0', '#FDE68A'], category: 'Bread' },
  Chapati:       { emoji: '🫓', gradient: ['#FFF9C4', '#FDD835'], category: 'Flatbread' },
  Poke:          { emoji: '🐟', gradient: ['#C8F0F8', '#A0E0F0'], category: 'Seafood' },
  Omelette:      { emoji: '🍳', gradient: ['#FFF9C4', '#FFF176'], category: 'Eggs' },
  Frittata:      { emoji: '🍳', gradient: ['#FFF9C4', '#FFF176'], category: 'Eggs' },
  Ice_cream:     { emoji: '🍦', gradient: ['#E3F2FD', '#BBDEFB'], category: 'Desserts' },
  Chocolate:     { emoji: '🍫', gradient: ['#EFEBE9', '#BCAAA4'], category: 'Desserts' },
  Cookie:        { emoji: '🍪', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Desserts' },
  Cake:          { emoji: '🎂', gradient: ['#FCE4EC', '#F8BBD9'], category: 'Desserts' },
  Peanut:        { emoji: '🥜', gradient: ['#EFEBE9', '#BCAAA4'], category: 'Snacks' },
  Almonds:       { emoji: '🌰', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Snacks' },
  Trail_mix:     { emoji: '🌰', gradient: ['#FFF3E0', '#FFCC80'], category: 'Snacks' },
  Water:         { emoji: '💧', gradient: ['#E3F2FD', '#BBDEFB'], category: 'Beverages' },
  Tea:           { emoji: '🍵', gradient: ['#E8F5E9', '#C8E6C9'], category: 'Beverages' },
  Protein_bar:   { emoji: '🍫', gradient: ['#EFEBE9', '#BCAAA4'], category: 'Snacks' },
  Granola:       { emoji: '🌾', gradient: ['#FFF3E0', '#FFCC80'], category: 'Breakfast' },
  Quinoa:        { emoji: '🌾', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Grains' },
  Pasta_salad:   { emoji: '🥗', gradient: ['#D4EDDA', '#B2DFDB'], category: 'Salads' },
  Fried_rice:    { emoji: '🍚', gradient: ['#FFF8E1', '#FFE082'], category: 'Rice Dishes' },
  Sashimi:       { emoji: '🐟', gradient: ['#C8F0F8', '#A0E0F0'], category: 'Seafood' },
  Ramen:         { emoji: '🍜', gradient: ['#FFF8E1', '#FFECB3'], category: 'Noodles' },
  Udon:          { emoji: '🍜', gradient: ['#FFF8E1', '#FFECB3'], category: 'Noodles' },
  Falafel:       { emoji: '🧆', gradient: ['#FFF3E0', '#FFD54F'], category: 'Street Food' },
  Hummus:        { emoji: '🧆', gradient: ['#FFF9C4', '#FDD835'], category: 'Healthy' },
  Tzatziki:      { emoji: '🥗', gradient: ['#D4EDDA', '#B2DFDB'], category: 'Healthy' },
  Shawarma:      { emoji: '🌯', gradient: ['#FFF3E0', '#FFE0B2'], category: 'Street Food' },
  Kebab:         { emoji: '🍖', gradient: ['#FDDEDE', '#FAC8C8'], category: 'Meat' },
  Tikka:         { emoji: '🍗', gradient: ['#FDEAC8', '#FFAB40'], category: 'Chicken' },
  Tandoori:      { emoji: '🍗', gradient: ['#FDEAC8', '#FF7043'], category: 'Chicken' },
  Butter_chicken:{ emoji: '🍗', gradient: ['#FEE8C8', '#FFAB40'], category: 'Curries' },
  Palak:         { emoji: '🥬', gradient: ['#C8E6C9', '#81C784'], category: 'Curries' },
  Chole:         { emoji: '🫘', gradient: ['#FFF8E1', '#F9A825'], category: 'Legumes' },
  Rajma:         { emoji: '🫘', gradient: ['#FDDEDE', '#EF9A9A'], category: 'Legumes' },
  Pav:           { emoji: '🍞', gradient: ['#FDEAC8', '#F8D59A'], category: 'Bread' },
  Bhaji:         { emoji: '🥦', gradient: ['#C8E6C9', '#A5D6A7'], category: 'Vegetables' },
  Upma:          { emoji: '🍚', gradient: ['#F5F5F0', '#E8E8E0'], category: 'Breakfast' },
  Poha:          { emoji: '🍚', gradient: ['#FFF9C4', '#FFF176'], category: 'Breakfast' },
  Khichdi:       { emoji: '🫘', gradient: ['#FFF8E1', '#FFE082'], category: 'Healthy' },
  Kheer:         { emoji: '🍚', gradient: ['#F5F5F0', '#E0E0E0'], category: 'Desserts' },
  Halwa:         { emoji: '🍮', gradient: ['#FFF9C4', '#FFD54F'], category: 'Desserts' },
  Ladoo:         { emoji: '🟡', gradient: ['#FFF9C4', '#FFD54F'], category: 'Desserts' },
  Gulab_jamun:   { emoji: '🟤', gradient: ['#EFEBE9', '#D7CCC8'], category: 'Desserts' },
  Jalebi:        { emoji: '🟠', gradient: ['#FFF3E0', '#FFCC80'], category: 'Desserts' },
  Lassi:         { emoji: '🥛', gradient: ['#E8F5E9', '#C8E6C9'], category: 'Beverages' },
  Chutney:       { emoji: '🌿', gradient: ['#C8E6C9', '#A5D6A7'], category: 'Condiments' },
  Raita:         { emoji: '🫙', gradient: ['#E8F5E9', '#C8E6C9'], category: 'Condiments' },
  Pickle:        { emoji: '🫙', gradient: ['#FFF8E1', '#FFE082'], category: 'Condiments' },
  Chips:         { emoji: '🍟', gradient: ['#FFF3E0', '#FFCC80'], category: 'Chips' },
  Wafer:         { emoji: '🍘', gradient: ['#FFF8E1', '#FFE082'], category: 'Savory Snacks' },
  Candy:         { emoji: '🍬', gradient: ['#FCE4EC', '#F8BBD9'], category: 'Candy' },
  Canned:        { emoji: '🥫', gradient: ['#ECEFF1', '#CFD8DC'], category: 'Canned Goods' },
  Packaged:      { emoji: '🏷️', gradient: ['#ECEFF1', '#CFD8DC'], category: 'Packaged' },
  Default:       { emoji: '🍽️', gradient: ['#F5F5F5', '#E8E8E8'], category: 'Other' },
};

// ── Keyword → category lookup ─────────────────────────────────────────────────
// Order matters: more specific terms first

const KEYWORD_MAP: Array<[string, keyof typeof CATEGORIES]> = [
  // Seafood
  ['salmon', 'Seafood'], ['tuna', 'Seafood'], ['prawn', 'Seafood'], ['shrimp', 'Seafood'],
  ['crab', 'Seafood'], ['lobster', 'Seafood'], ['fish', 'Seafood'], ['poke', 'Poke'],
  ['sashimi', 'Sashimi'], ['sushi', 'Sushi'], ['seafood', 'Seafood'], ['squid', 'Seafood'],
  ['octopus', 'Seafood'], ['mussel', 'Seafood'], ['clam', 'Seafood'], ['oyster', 'Seafood'],
  // Packaged snacks (checked early — generic words like "potato"/"sandwich" often
  // appear inside more specific compound category names from Open Food Facts, e.g.
  // "potato crisps" or "sandwich biscuits", so the specific snack word must win first)
  ['chip', 'Chips'], ['crisp', 'Chips'], ['nachos', 'Chips'], ['tortilla chip', 'Chips'],
  ['rice cracker', 'Wafer'], ['cookie', 'Cookie'], ['biscuit', 'Cookie'], ['cracker', 'Cookie'],
  // Chicken / Meat
  ['butter chicken', 'Butter_chicken'], ['chicken tikka', 'Tikka'], ['tandoori', 'Tandoori'],
  ['tikka masala', 'Tikka'], ['tikka', 'Tikka'], ['chicken', 'Chicken'],
  ['turkey', 'Meat'], ['lamb', 'Lamb'], ['mutton', 'Lamb'], ['pork', 'Pork'],
  ['bacon', 'Meat'], ['sausage', 'Meat'], ['ham', 'Meat'], ['beef', 'Steak'],
  ['steak', 'Steak'], ['meatball', 'Meat'], ['kebab', 'Kebab'], ['seekh', 'Kebab'],
  ['shawarma', 'Shawarma'], ['meat', 'Meat'],
  // Eggs
  ['omelette', 'Omelette'], ['omelet', 'Omelette'], ['egg', 'Eggs'],
  ['frittata', 'Frittata'], ['scrambled', 'Eggs'], ['boiled egg', 'Eggs'],
  // Rice / Biryani
  ['biryani', 'Biryani'], ['pulao', 'Biryani'], ['fried rice', 'Fried_rice'],
  ['congee', 'Rice'], ['rice', 'Rice'], ['risotto', 'Rice'],
  // Indian bread
  ['paratha', 'Paratha'], ['chapati', 'Chapati'], ['roti', 'Chapati'], ['naan', 'Naan'],
  ['puri', 'Flatbread'], ['bhatura', 'Flatbread'], ['dosa', 'Dosa'], ['uttapam', 'Dosa'],
  ['idli', 'Idli'], ['upma', 'Upma'], ['poha', 'Poha'],
  // Bread
  ['toast', 'Bread'], ['bread', 'Bread'], ['bun', 'Bread'], ['bagel', 'Bread'],
  ['croissant', 'Bread'], ['pita', 'Flatbread'], ['lavash', 'Flatbread'],
  // Curry / Dal
  ['palak', 'Palak'], ['saag', 'Palak'], ['paneer', 'Curry'],
  ['chole', 'Chole'], ['chana', 'Dal'], ['rajma', 'Rajma'], ['dal', 'Dal'],
  ['daal', 'Dal'], ['sambar', 'Dal'], ['kadhi', 'Curry'], ['curry', 'Curry'],
  ['masala', 'Curry'], ['korma', 'Curry'], ['makhani', 'Curry'], ['bhuna', 'Curry'],
  // Legumes
  ['lentil', 'Lentils'], ['bean', 'Beans'], ['tofu', 'Tofu'], ['tempeh', 'Tofu'],
  ['soya', 'Tofu'], ['edamame', 'Tofu'], ['peas', 'Vegetables'], ['chickpea', 'Chole'],
  // Noodles / Pasta
  ['ramen', 'Ramen'], ['udon', 'Udon'], ['soba', 'Noodles'], ['noodle', 'Noodles'],
  ['pad thai', 'Noodles'], ['mie', 'Noodles'], ['pasta', 'Pasta'],
  ['spaghetti', 'Pasta'], ['penne', 'Pasta'], ['linguine', 'Pasta'],
  ['lasagne', 'Pasta'], ['lasagna', 'Pasta'], ['fettuccine', 'Pasta'],
  ['macaroni', 'Pasta'], ['carbonara', 'Pasta'],
  // Soup
  ['soup', 'Soup'], ['stew', 'Soup'], ['broth', 'Soup'], ['bisque', 'Soup'],
  ['chowder', 'Soup'], ['dal soup', 'Soup'], ['rasam', 'Soup'],
  // Salad
  ['salad', 'Salad'], ['coleslaw', 'Salad'], ['slaw', 'Salad'], ['tabbouleh', 'Salad'],
  ['fattoush', 'Salad'], ['caesar', 'Salad'], ['greek salad', 'Salad'],
  // Vegetables
  ['broccoli', 'Broccoli'], ['spinach', 'Spinach'], ['kale', 'Spinach'],
  ['mushroom', 'Mushroom'], ['corn', 'Corn'], ['potato', 'Potato'],
  ['aloo', 'Potato'], ['sweet potato', 'Potato'], ['tomato', 'Tomato'],
  ['carrot', 'Carrot'], ['avocado', 'Avocado'], ['cucumber', 'Vegetables'],
  ['lettuce', 'Salad'], ['cabbage', 'Vegetables'], ['cauliflower', 'Vegetables'],
  ['pumpkin', 'Vegetables'], ['courgette', 'Vegetables'], ['zucchini', 'Vegetables'],
  ['bhindi', 'Vegetables'], ['okra', 'Vegetables'], ['pav bhaji', 'Bhaji'],
  ['bhaji', 'Bhaji'], ['sabzi', 'Vegetables'], ['subzi', 'Vegetables'],
  // Fruits
  ['apple', 'Apple'], ['banana', 'Banana'], ['mango', 'Mango'], ['orange', 'Orange'],
  ['grape', 'Grapes'], ['strawberry', 'Strawberry'], ['watermelon', 'Watermelon'],
  ['pineapple', 'Pineapple'], ['peach', 'Fruits'], ['plum', 'Fruits'],
  ['cherry', 'Fruits'], ['blueberry', 'Fruits'], ['raspberry', 'Fruits'],
  ['kiwi', 'Fruits'], ['papaya', 'Fruits'], ['guava', 'Fruits'], ['lychee', 'Fruits'],
  ['coconut', 'Fruits'], ['pomegranate', 'Fruits'], ['fig', 'Fruits'],
  // Fast food
  ['pizza', 'Pizza'], ['burger', 'Burger'], ['hot dog', 'Burger'],
  ['fries', 'Snack'], ['nuggets', 'Chicken'],
  ['wrap', 'Wrap'], ['sandwich', 'Sandwich'], ['sub', 'Sandwich'],
  ['taco', 'Taco'], ['burrito', 'Wrap'], ['quesadilla', 'Taco'],
  // Indian street food
  ['samosa', 'Samosa'], ['pakora', 'Pakora'], ['bhajiya', 'Pakora'],
  ['vada', 'Pakora'], ['pani puri', 'Chaat'], ['gol gappa', 'Chaat'],
  ['sev puri', 'Chaat'], ['chaat', 'Chaat'], ['dabeli', 'Chaat'],
  ['kachori', 'Samosa'], ['dhokla', 'Snack'],
  // Breakfast
  ['pancake', 'Pancake'], ['waffle', 'Waffle'], ['french toast', 'Bread'],
  ['granola', 'Granola'], ['oats', 'Oats'], ['oatmeal', 'Oats'],
  ['cereal', 'Cereal'], ['muesli', 'Oats'], ['porridge', 'Oats'],
  // Dairy
  ['yogurt', 'Yogurt'], ['curd', 'Yogurt'], ['cheese', 'Cheese'],
  ['milk', 'Milk'], ['paneer', 'Cheese'], ['lassi', 'Lassi'],
  ['raita', 'Raita'], ['cream', 'Dairy'],
  // Beverages
  ['smoothie', 'Smoothie'], ['milkshake', 'Smoothie'], ['shake', 'Smoothie'],
  ['juice', 'Juice'], ['lemonade', 'Juice'], ['agua fresca', 'Juice'],
  ['coffee', 'Coffee'], ['latte', 'Coffee'], ['cappuccino', 'Coffee'],
  ['espresso', 'Coffee'], ['tea', 'Tea'], ['chai', 'Tea'], ['matcha', 'Tea'],
  ['water', 'Water'], ['drink', 'Beverage'], ['soda', 'Beverage'],
  ['beer', 'Beverage'], ['wine', 'Beverage'],
  // Desserts
  ['ice cream', 'Ice_cream'], ['gelato', 'Ice_cream'], ['sorbet', 'Ice_cream'],
  ['chocolate', 'Chocolate'], ['brownie', 'Chocolate'], ['fudge', 'Chocolate'],
  ['cake', 'Cake'], ['cupcake', 'Dessert'], ['muffin', 'Dessert'],
  ['donut', 'Dessert'], ['doughnut', 'Dessert'], ['pastry', 'Dessert'],
  ['pie', 'Dessert'], ['tart', 'Dessert'], ['pudding', 'Dessert'],
  ['halwa', 'Halwa'], ['kheer', 'Kheer'], ['khir', 'Kheer'],
  ['ladoo', 'Ladoo'], ['laddoo', 'Ladoo'], ['barfi', 'Dessert'],
  ['mithai', 'Dessert'], ['gulab jamun', 'Gulab_jamun'], ['gulab', 'Gulab_jamun'],
  ['jalebi', 'Jalebi'], ['rasmalai', 'Dessert'], ['rasgulla', 'Dessert'],
  // Snacks / Nuts
  ['peanut', 'Peanut'], ['almond', 'Almonds'], ['cashew', 'Almonds'],
  ['walnut', 'Almonds'], ['pistachio', 'Almonds'], ['nut', 'Almonds'],
  ['trail mix', 'Trail_mix'], ['protein bar', 'Protein_bar'], ['energy bar', 'Protein_bar'],
  ['granola bar', 'Granola'], ['popcorn', 'Snack'], ['pretzel', 'Snack'],
  // Grains
  ['quinoa', 'Quinoa'], ['couscous', 'Quinoa'], ['millet', 'Quinoa'],
  ['barley', 'Quinoa'], ['wheat', 'Bread'], ['oat', 'Oats'],
  // Middle Eastern
  ['falafel', 'Falafel'], ['hummus', 'Hummus'], ['tahini', 'Hummus'],
  ['tzatziki', 'Tzatziki'], ['baba ganoush', 'Hummus'],
  // Condiments
  ['chutney', 'Chutney'], ['pickle', 'Pickle'], ['achar', 'Pickle'],
  // Indian savory snacks
  ['namkeen', 'Wafer'], ['bhujia', 'Wafer'], ['mixture', 'Wafer'], ['chikki', 'Wafer'],
  ['bhakarwadi', 'Wafer'], ['wafer', 'Wafer'],
  // Candy
  ['candy', 'Candy'], ['toffee', 'Candy'], ['gummy', 'Candy'], ['gummies', 'Candy'],
  ['lollipop', 'Candy'], ['mint', 'Candy'], ['chewing gum', 'Candy'],
  // Sodas / colas (brand names commonly seen in barcode scans)
  ['cola', 'Beverage'], ['coke', 'Beverage'], ['pepsi', 'Beverage'],
  ['soft drink', 'Beverage'], ['energy drink', 'Beverage'], ['sports drink', 'Beverage'],
  // Instant noodles
  ['maggi', 'Noodles'], ['instant noodle', 'Noodles'], ['cup noodle', 'Noodles'],
  // Canned goods
  ['canned', 'Canned'], ['tinned', 'Canned'], ['baked beans', 'Canned'],
  // More biscuits/crackers
  ['rusk', 'Cookie'], ['marie gold', 'Cookie'], ['digestive biscuit', 'Cookie'],
  // Packaged (generic last resort — only reached if nothing above matched)
  ['packaged', 'Packaged'], ['label', 'Packaged'],
];

// ── Main function ─────────────────────────────────────────────────────────────

export function getFoodIcon(foodName: string): FoodIconInfo {
  const lower = (foodName || '').toLowerCase();

  for (const [keyword, category] of KEYWORD_MAP) {
    if (lower.includes(keyword)) {
      return CATEGORIES[category] ?? CATEGORIES.Default;
    }
  }

  return CATEGORIES.Default;
}

export function getFoodEmoji(foodName: string): string {
  return getFoodIcon(foodName).emoji;
}

export function getFoodGradient(foodName: string): [string, string] {
  return getFoodIcon(foodName).gradient;
}
