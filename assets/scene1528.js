/* ── reveal on scroll ──
   Chapters on a destination page start hidden (`.js .reveal` in site.css) and fade up as they
   come into view. Everything is scoped to html.js, so with JS absent the page is simply
   readable — nothing here can hide content permanently.

   This file used to be the cinematic homepage's engine: a scroll-driven Three.js India on a
   fixed .stage, text .beats, and a parallaxed .iband monument strip. index.php is now the
   illustrated journey and runs journey.js instead; no template renders .film/.stage/.beat/
   .iband any more, and footer_html() never loads three.js, so all of that was unreachable and
   has been removed. The reveal observer below is what was still doing real work. */
(function(){
  if(!('IntersectionObserver' in window)){
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
    return;
  }
  var rio=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); rio.unobserve(e.target); } });
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){ rio.observe(el); });
})();
