"use strict";

module.exports = (srv) => {
  const { Book } = srv.entities;

  srv.on("order", Book, async (req) => {
    return {
      author: req.params[0].author,
      genre_ID: req.params[0].genre_ID,
      stock: req.data.number,
      description: req._.req.query.ID__,
    };
  });
};
