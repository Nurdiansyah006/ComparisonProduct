import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://vaxhuzmrwhctjxaabemj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZheGh1em1yd2hjdGp4YWFiZW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjQxNzIsImV4cCI6MjA5NzY0MDE3Mn0.7gvOLzQzeckg939R6ObcT4ebGqLHfSEKH3X5sYhpC-M";
const supabase = createClient(supabaseUrl, supabaseKey);

async function addAdmin() {
  console.log("Inserting admin user...");
  const { data, error } = await supabase
    .from("app_users")
    .insert({ username: 'jayasurveying0@gmail.com', password: 'admin123', role: 'admin' })
    .select();
  
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Insert Success Data:", data);
  }
}

addAdmin();
